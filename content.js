// Guard against multiple injections with IIFE pattern
(function () {
  // Check if already injected
  if (window.churchExtensionInjected) return;
  window.churchExtensionInjected = true;

  console.log("Church attendance extension loaded");

  // Global variables
  let attendanceData = null;
  let allExtractedMembers = []; // Store all members across pagination

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.action === "applyAttendance") {
        applyAttendanceData(sendResponse);
        return true; // Keep the message channel open for async response
      } else if (request.action === "extractNames") {
        extractMemberNames(sendResponse);
        return true; // Keep the message channel open for async response
      } else if (request.action === "resetExtraction") {
        resetExtraction(sendResponse);
        return true;
      } else if (request.action === "getExtractedNames") {
        // Return the current list of extracted names
        sendResponse({
          success: true,
          names: allExtractedMembers,
          message: `Retrieved ${allExtractedMembers.length} extracted names.`
        });
        return true;
      }
      return false;
    },
  );

  // Reset the extraction process
  function resetExtraction(sendResponse) {
    allExtractedMembers = [];
    console.log("Name extraction has been reset");
    sendResponse({
      success: true,
      message: "Name extraction reset successfully",
    });
  }

  // Get attendance data from extension storage
  function getAttendanceData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["attendanceData"], function (result) {
        resolve(result.attendanceData || []);
      });
    });
  }

  // Main function to apply attendance data to the page
  async function applyAttendanceData(sendResponse) {
    try {
      if (!isAttendancePage()) {
        sendResponse({
          success: false,
          error: "Please navigate to the church attendance page first.",
        });
        return;
      }

      // Get the stored attendance data
      attendanceData = await getAttendanceData();

      if (!attendanceData || attendanceData.length === 0) {
        sendResponse({
          success: false,
          error: "No attendance data found. Please import data first.",
        });
        return;
      }

      // Parse dates from the table
      const dates = parseDatesFromPage();
      if (dates.length === 0) {
        sendResponse({
          success: false,
          error: "Could not find date columns in the attendance table.",
        });
        return;
      }

      // Get members from the page
      const pageMembers = parseMembersFromPage();
      if (pageMembers.length === 0) {
        sendResponse({
          success: false,
          error: "Could not find any members in the attendance table.",
        });
        return;
      }

      // Apply attendance data
      let markedCount = 0;

      for (const member of attendanceData) {
        // Find corresponding row for this member
        const matchingMember = pageMembers.find(
          (pageMember) => pageMember.name === member.name,
        );

        if (matchingMember) {
          // Find which dates need to be marked
          for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            // Check if the member should be marked for this date
            const shouldMark = member.dates.some(
              (memberDate) => memberDate === date,
            );

            if (shouldMark) {
              // Mark attendance for this member on this date
              const wasMarked = markAttendance(matchingMember.row, i);
              if (wasMarked) markedCount++;
            }
          }
        }
      }

      sendResponse({
        success: true,
        markedCount: markedCount,
        memberCount: attendanceData.length,
        message: `Marked ${markedCount} attendance entries for ${attendanceData.length} members.`,
      });
    } catch (error) {
      console.error("Error in applyAttendanceData:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Check if we're on the attendance page
  function isAttendancePage() {
    const title = document.title;
    return (
      title.includes("Attendance") ||
      document.querySelector(".attendance-table") !== null ||
      document.querySelector("table") !== null
    );
  }

  // Parse dates from the attendance table headers
  function parseDatesFromPage() {
    const dates = [];
    const headerRow = document.querySelector("tr");

    if (headerRow) {
      // Get all header cells after the first (name) column
      const headerCells = headerRow.querySelectorAll("th");

      headerCells.forEach((cell, index) => {
        // Skip the first column which is usually the name
        if (index > 0) {
          const dateText = cell.textContent.trim();
          if (
            dateText &&
            dateText !== "Gender" &&
            !dateText.includes("Gender")
          ) {
            dates.push(dateText);
          }
        }
      });
    }

    return dates;
  }

  // Parse member names and their current attendance status from the page
  function parseMembersFromPage() {
    const members = [];
    const rows = document.querySelectorAll("tr");

    rows.forEach((row) => {
      const nameCell = row.querySelector("td a");
      if (nameCell) {
        const name = nameCell.textContent.trim();
        members.push({
          name: name,
          row: row,
        });
      }
    });

    return members;
  }

  // Mark attendance for a specific member and date
  function markAttendance(row, dateIndex) {
    try {
      // Find the attendance cell for the specific date
      const attendanceCells = Array.from(row.querySelectorAll("td")).slice(1); // Skip name cell
      if (!attendanceCells[dateIndex]) return false;

      // Find clickable element in the cell (could be div, span, or the cell itself)
      const clickTarget =
        attendanceCells[dateIndex].querySelector('input[type="checkbox"]') ||
        attendanceCells[dateIndex].querySelector(".clickable") ||
        attendanceCells[dateIndex];

      // Check if already marked
      const isAlreadyMarked =
        attendanceCells[dateIndex].classList.contains("marked") ||
        clickTarget.checked === true;

      // If not already marked, click to mark attendance
      if (!isAlreadyMarked) {
        clickTarget.click();
        return true;
      }

      return false;
    } catch (e) {
      console.error("Error marking attendance:", e);
      return false;
    }
  }

  // Function to extract member names from current page - simplified approach
  async function extractMemberNames(sendResponse) {
    try {
      if (!isAttendancePage()) {
        sendResponse({
          success: false,
          error: "Please navigate to the church attendance page first.",
        });
        return;
      }

      console.log("Starting name extraction from current page");

      // First try to increase per page count to 100 if possible
      await trySetPerPageTo100();

      // Extract names from the current page
      const newMembers = extractNamesFromCurrentPage();

      // Add new members to our global collection, avoiding duplicates
      const beforeCount = allExtractedMembers.length;
      addUniqueMembers(newMembers);
      const addedCount = allExtractedMembers.length - beforeCount;

      // Get page count info if available
      const pageInfo = getPageInfo();

      sendResponse({
        success: true,
        names: allExtractedMembers,
        currentPageCount: newMembers.length,
        totalUniqueCount: allExtractedMembers.length,
        newlyAddedCount: addedCount,
        pageInfo: pageInfo,
        message: `Extracted ${newMembers.length} names from current page. Added ${addedCount} new unique names. Total unique names: ${allExtractedMembers.length}.${pageInfo ? " " + pageInfo.message : ""}`,
      });
    } catch (error) {
      console.error("Error extracting member names:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Function to try setting the per-page selector to 100
  async function trySetPerPageTo100() {
    try {
      // Find the per-page selector by looking for a select element that has options for 50 and 100
      const perPageSelects = Array.from(
        document.querySelectorAll("select"),
      ).filter((select) => {
        const options = Array.from(select.options).map((opt) => opt.value);
        return options.includes("50") && options.includes("100");
      });

      // If we found a per-page selector, set it to 100 to minimize pagination
      if (perPageSelects.length > 0) {
        console.log("Found per-page selector:", perPageSelects[0]);
        const select = perPageSelects[0];

        // If it's not already set to 100, set it
        if (select.value !== "100") {
          console.log("Setting per-page selector to 100 entries");
          select.value = "100";

          // Dispatch change event to trigger page update
          const event = new Event("change", { bubbles: true });
          select.dispatchEvent(event);

          // Give it time to update the page
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return true;
        } else {
          console.log("Per-page selector already set to 100");
          return true;
        }
      } else {
        console.log("No per-page selector found");
        return false;
      }
    } catch (e) {
      console.error("Error setting per-page selector:", e);
      return false;
    }
  }

  // Extract page information from pagination controls
  function getPageInfo() {
    try {
      // Look for pagination text that shows current page/total pages
      const paginationElements = document.querySelectorAll("div, span");

      // Look for pattern like "1-50 of 264" or "Page 1 of 5"
      for (const element of paginationElements) {
        const text = element.textContent.trim();

        // Pattern: "1-50 of 264" or "1-50/264"
        let match = text.match(/(\d+)-(\d+)(?:\s+of|\s*\/)\s*(\d+)/i);
        if (match) {
          const start = parseInt(match[1]);
          const end = parseInt(match[2]);
          const total = parseInt(match[3]);
          const currentPage = Math.ceil(end / (end - start + 1));
          const totalPages = Math.ceil(total / (end - start + 1));

          return {
            currentPage,
            totalPages,
            totalEntries: total,
            message: `Showing page ${currentPage} of ${totalPages} (${total} total entries)`,
          };
        }

        // Pattern: "Page 1 of 5"
        match = text.match(/page\s+(\d+)\s+of\s+(\d+)/i);
        if (match) {
          const currentPage = parseInt(match[1]);
          const totalPages = parseInt(match[2]);

          return {
            currentPage,
            totalPages,
            message: `Showing page ${currentPage} of ${totalPages}`,
          };
        }
      }

      return null;
    } catch (e) {
      console.error("Error getting page info:", e);
      return null;
    }
  }

  // Function to extract names from the current page
  function extractNamesFromCurrentPage() {
    const memberNames = [];

    // Look for rows with anchor tags in the first cell
    const rows = document.querySelectorAll("tr");
    console.log(`Found ${rows.length} total rows on page`);

    let memberRowCount = 0;

    rows.forEach((row) => {
      const nameCell = row.querySelector("td a");
      if (nameCell) {
        memberRowCount++;
        const fullName = nameCell.textContent.trim();
        const genderCell = row.querySelector("td:nth-child(2)");
        const gender = genderCell ? genderCell.textContent.trim() : "";
        memberNames.push({ name: fullName, gender: gender });
      }
    });

    console.log(
      `Extracted ${memberNames.length} member names from current page`,
    );
    return memberNames;
  }

  // Add unique members to the global collection
  function addUniqueMembers(newMembers) {
    if (!newMembers || newMembers.length === 0) return;

    // Create a map of existing names for efficient lookup
    const existingNames = new Map();
    allExtractedMembers.forEach((member) =>
      existingNames.set(member.name, true),
    );

    // Add only non-duplicate members
    newMembers.forEach((member) => {
      if (!existingNames.has(member.name)) {
        allExtractedMembers.push(member);
        existingNames.set(member.name, true);
      }
    });
  }
})();
