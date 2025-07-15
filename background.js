// Handle extension installation or update
chrome.runtime.onInstalled.addListener(function (details) {
  console.log("Church Attendance Extension installed");
  
  // Clear any existing OAuth tokens to force re-authentication with new scopes
  if (details.reason === 'update' || details.reason === 'install') {
    chrome.storage.local.remove(['token'], function() {
      console.log('OAuth token cleared. User will need to re-authenticate with new scopes.');
    });
  }
});

// Handle clicking the extension icon to open the side panel
chrome.action.onClicked.addListener((tab) => {
  // Only open side panel on valid church pages
  if (tab.url.includes('churchofjesuschrist.org')) {
    // Open the side panel
    chrome.sidePanel.open({ tabId: tab.id });
  } else {
    // Create notification for invalid page
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'Church Attendance Updater',
      message: 'Please navigate to a Church of Jesus Christ page to use this extension.'
    });
  }
});

// Listen for messages from the popup or side panel
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "authorize") {
    authorizeUser(sendResponse);
    return true; // Keep the message channel open for async response
  } else if (request.action === "fetchSheetData") {
    fetchSheetData(request.spreadsheetId, request.sheetName, sendResponse);
    return true; // Keep the message channel open for async response
  } else if (request.action === "updateSheetWithNames") {
    updateSheetWithNames(request.names, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Function to authorize with Google
function authorizeUser(sendResponse) {
  chrome.identity.getAuthToken({ interactive: true }, function (token) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (token) {
      // Store token
      chrome.storage.local.set({ token: token });
      sendResponse({ success: true, token: token });
    } else {
      sendResponse({ success: false, error: "Failed to get auth token" });
    }
  });
}

// Function to fetch data from Google Sheet
function fetchSheetData(spreadsheetId, sheetName, sendResponse) {
  chrome.storage.local.get("token", function (data) {
    if (!data.token) {
      sendResponse({ success: false, error: "Not authenticated" });
      return;
    }

    // Fetch the spreadsheet data using Google Sheets API
    const range = `${sheetName}!A:Z`; // Get all data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${data.token}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // If sheet is empty or has no data, create an empty dataset with headers
        if (!data.values || data.values.length === 0) {
          // Create an empty dataset with just column headers
          const today = new Date();
          const formattedDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

          // Empty sheet with just a header and date column
          const emptyData = [
            [
              "Name", // First column for names
              formattedDate, // Today's date as column header
            ],
          ];

          // Process this minimal dataset
          const processedData = processSheetData(emptyData);

          // Store processed data
          chrome.storage.local.set({ attendanceData: processedData });

          sendResponse({ success: true, data: processedData });
          return;
        }

        // Process the sheet data if it exists
        const processedData = processSheetData(data.values);

        // Store processed data
        chrome.storage.local.set({ attendanceData: processedData });

        sendResponse({ success: true, data: processedData });
      })
      .catch((error) => {
        console.error("Error fetching sheet data:", error);
        sendResponse({ success: false, error: error.message });
      });
  });
}

// Process the raw sheet data into a usable format
function processSheetData(values) {
  // Assumes the first row contains headers (dates)
  const headers = values[0];
  const result = [];

  // Skip the header row and process each member row
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.length === 0 || !row[0]) continue; // Skip empty rows

    const memberData = {
      name: row[0], // First column is member name
    };

    // Map each date column to its attendance status
    // Our format uses TRUE for present and FALSE or empty for absent
    for (let j = 1; j < headers.length; j++) {
      if (headers[j]) {
        // Convert date format from "M/D/YYYY" to "D MMM" format (e.g., "15 Jun")
        const dateObj = new Date(headers[j]);
        if (!isNaN(dateObj.getTime())) {
          const day = dateObj.getDate();
          // Get month abbreviation
          const month = dateObj.toLocaleString("en-US", { month: "short" });
          const formattedDate = `${day} ${month}`;

          // Determine attendance status from TRUE/FALSE values
          if (row[j] && row[j].toString().toUpperCase() === "TRUE") {
            memberData[formattedDate] = "present";
          } else {
            memberData[formattedDate] = "absent";
          }
        } else {
          // If date parsing fails, use the original header
          memberData[headers[j]] =
            row[j] && row[j].toString().toUpperCase() === "TRUE"
              ? "present"
              : "absent";
        }
      }
    }

    result.push(memberData);
  }

  return result;
}

// Function to get the stored OAuth token
async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["token"], function (result) {
      resolve(result.token);
    });
  });
}

// Function to update Google Sheets with extracted member names
async function updateSheetWithNames(memberNames, sendResponse) {
  try {
    // Check if we have valid member names
    if (!memberNames || memberNames.length === 0) {
      sendResponse({ success: false, error: "No member names provided." });
      return;
    }

    // Get the OAuth token
    const token = await getToken();
    if (!token) {
      sendResponse({
        success: false,
        error: "Not authorized. Please authorize first.",
      });
      return;
    }

    // Get spreadsheet ID from storage
    const spreadsheetId = "1GcL6fnfT2VoXqQOyVEcD2gsW2wl87HC6TcikJ89RIps";
    const sheetName = "attendance test 2";

    // First, check if the spreadsheet exists and get its metadata
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!metadataResponse.ok) {
      if (metadataResponse.status === 404) {
        // Spreadsheet doesn't exist, create it
        sendResponse({
          success: false,
          error:
            "Spreadsheet does not exist. Please create it first in Google Sheets.",
        });
        return;
      } else {
        const errorText = await metadataResponse.text();
        throw new Error(`Failed to access spreadsheet: ${errorText}`);
      }
    }

    const metadata = await metadataResponse.json();

    // Check if our target sheet exists
    let sheetExists = false;
    let sheetId = null;

    if (metadata && metadata.sheets) {
      for (const sheet of metadata.sheets) {
        if (sheet.properties.title === sheetName) {
          sheetExists = true;
          sheetId = sheet.properties.sheetId;
          break;
        }
      }
    }

    // If sheet doesn't exist, create it
    if (!sheetExists) {
      console.log(`Sheet '${sheetName}' doesn't exist, creating it now...`);
      const createSheetRequest = {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      };

      const createSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const createSheetResponse = await fetch(createSheetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createSheetRequest),
      });

      if (!createSheetResponse.ok) {
        const errorText = await createSheetResponse.text();
        throw new Error(`Failed to create sheet: ${errorText}`);
      }

      const createSheetResult = await createSheetResponse.json();
      sheetId = createSheetResult.replies[0].addSheet.properties.sheetId;

      // Add header row for the new sheet
      const headerRow = ["Name", "Gender", "Current Date"];
      const addHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:C1?valueInputOption=RAW`;
      const addHeaderResponse = await fetch(addHeaderUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [headerRow],
          majorDimension: "ROWS",
        }),
      });

      if (!addHeaderResponse.ok) {
        const errorText = await addHeaderResponse.text();
        throw new Error(`Failed to add header row: ${errorText}`);
      }
    }

    // Now fetch the current content of the sheet
    const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const fetchResponse = await fetch(fetchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    // Handle case where fetch fails after creating sheet
    let values = [];
    if (fetchResponse.ok) {
      const sheetData = await fetchResponse.json();
      values = sheetData.values || [];
    } else {
      // If we just created the sheet but can't fetch data yet, initialize with empty values
      values = [["Name", "Gender", "Current Date"]];
    }

    // Get the existing names from the sheet
    const existingNames = new Set();
    if (values.length > 1) {
      for (let i = 1; i < values.length; i++) {
        if (values[i][0]) {
          existingNames.add(values[i][0]);
        }
      }
    }

    // Get current date for the new records
    const today = new Date();
    const formattedDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

    // Identify new names to add and prepare rows with proper format
    const newRows = [];
    const newNamesList = [];

    memberNames.forEach((member) => {
      if (!existingNames.has(member.name)) {
        // Format: [Name, Gender, Current Date]
        newRows.push([member.name, member.gender || "", formattedDate]);
        newNamesList.push(member.name);
      }
    });

    if (newRows.length === 0) {
      sendResponse({
        success: true,
        message: "No new names to add. All members already in the sheet.",
      });
      return;
    }

    // Determine where to append the new rows
    const startRow = Math.max(values.length, 1); // If the sheet is empty or only has headers
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A${startRow + 1}:append?valueInputOption=USER_ENTERED`;

    // Append the new rows to the sheet
    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: newRows,
        majorDimension: "ROWS",
      }),
    });

    if (!appendResponse.ok) {
      const errorText = await appendResponse.text();
      throw new Error(`Failed to update sheet with new names: ${errorText}`);
    }

    // Sort the sheet (requires a separate Sheets API call)
    // Use the actual sheetId we got earlier
    const sortRequest = {
      requests: [
        {
          sortRange: {
            range: {
              sheetId: sheetId || 0, // Use the sheet ID we found or created
              startRowIndex: 1, // Skip header row
              startColumnIndex: 0,
              endColumnIndex: 3, // Sort based on all columns we use
            },
            sortSpecs: [
              {
                dimensionIndex: 0, // Sort by first column (names)
                sortOrder: "ASCENDING",
              },
            ],
          },
        },
      ],
    };

    const sortUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const sortResponse = await fetch(sortUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sortRequest),
    });

    if (!sortResponse.ok) {
      const errorText = await sortResponse.text();
      console.warn(`Failed to sort sheet: ${errorText}`);
      // Continue even if sorting fails
    }

    sendResponse({
      success: true,
      message: `Added ${newRows.length} new members to the sheet.`,
      newNames: newNamesList,
    });
  } catch (error) {
    console.error("Error updating sheet with names:", error);
    sendResponse({ success: false, error: error.message });
  }
}
