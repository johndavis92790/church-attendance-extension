// Global variables
let attendanceData = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'applyAttendance') {
    applyAttendanceData(sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Get attendance data from extension storage
function getAttendanceData() {
  return new Promise((resolve) => {
    chrome.storage.local.get('attendanceData', function(data) {
      if (data.attendanceData) {
        resolve(data.attendanceData);
      } else {
        resolve(null);
      }
    });
  });
}

// Main function to apply attendance data to the page
async function applyAttendanceData(sendResponse) {
  try {
    // Get attendance data from storage
    attendanceData = await getAttendanceData();
    
    if (!attendanceData) {
      sendResponse({ success: false, error: 'No attendance data found. Please load from Google Sheets first.' });
      return;
    }
    
    // Check if we're on the attendance page
    if (!isAttendancePage()) {
      sendResponse({ success: false, error: 'Please navigate to the church attendance page first.' });
      return;
    }
    
    // Parse the page to get the current dates shown
    const dates = parseDatesFromPage();
    
    if (!dates || dates.length === 0) {
      sendResponse({ success: false, error: 'Could not find dates on the attendance page.' });
      return;
    }
    
    // Get all members from the page
    const members = parseMembersFromPage();
    
    if (!members || members.length === 0) {
      sendResponse({ success: false, error: 'Could not find members on the attendance page.' });
      return;
    }
    
    // Mark attendance based on the spreadsheet data
    let markedCount = 0;
    members.forEach(member => {
      const memberData = attendanceData.find(row => row.name.toLowerCase().includes(member.name.toLowerCase()));
      
      if (memberData) {
        dates.forEach((date, index) => {
          // Check if the date exists in the spreadsheet data
          if (memberData[date] && memberData[date].toLowerCase() === 'present') {
            // Mark as present if not already marked
            if (!member.attendanceStatus[index] || member.attendanceStatus[index] === 'empty') {
              markAttendance(member.row, index);
              markedCount++;
            }
          }
        });
      }
    });
    
    sendResponse({ success: true, message: `Successfully updated ${markedCount} attendance records.` });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Check if we're on the attendance page
function isAttendancePage() {
  return document.querySelector('title')?.textContent?.includes('Class and Quorum Attendance') || 
         document.querySelector('h1')?.textContent?.includes('Class and Quorum Attendance');
}

// Parse dates from the attendance table headers
function parseDatesFromPage() {
  const dateHeaders = Array.from(document.querySelectorAll('th')).filter(th => {
    const text = th.textContent.trim();
    // Look for date formats like "15 Jun", "22 Jun", etc.
    return /\d{1,2}\s+[A-Za-z]{3}/.test(text);
  });
  
  return dateHeaders.map(header => header.textContent.trim());
}

// Parse member names and their current attendance status from the page
function parseMembersFromPage() {
  const members = [];
  const rows = document.querySelectorAll('tr.sc-e43ca95b-0');
  
  rows.forEach(row => {
    const nameCell = row.querySelector('td a');
    if (nameCell) {
      const name = nameCell.textContent.trim();
      // Get all cells that might contain attendance indicators
      const attendanceCells = Array.from(row.querySelectorAll('td'));
      
      // Filter out name and gender cells (first 3 cells including the arrow)
      const dateAttendanceCells = attendanceCells.slice(3);
      
      // Map attendance status for each date column
      const attendanceStatus = dateAttendanceCells.map(cell => {
        // Look for the SVG path to determine status
        const svg = cell.querySelector('svg');
        if (!svg) return 'empty';
        
        const path = svg.querySelector('path');
        if (!path) return 'empty';
        
        const pathData = path.getAttribute('d');
        // Check if it's marked as present (has "fill-rule="evenodd"" in the path - checkmark)
        if (pathData && pathData.includes('fill-rule="evenodd"')) {
          return 'present';
        } else {
          // It's an empty circle
          return 'empty';
        }
      });
      
      members.push({
        name,
        row,
        attendanceStatus
      });
    }
  });
  
  return members;
}

// Mark attendance for a specific member and date
function markAttendance(row, dateIndex) {
  // Find the attendance cell for the given date index
  // Add 3 to skip the name, gender, and navigation cells
  const targetCell = row.querySelectorAll('td')[dateIndex + 3];
  
  if (targetCell) {
    // Look for the element we need to click (this could be the SVG or a containing div)
    const clickTarget = targetCell.querySelector('div') || targetCell;
    
    // Create and dispatch a mousedown and click event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    // Try to simulate a more realistic click by adding a small delay
    setTimeout(() => {
      clickTarget.dispatchEvent(clickEvent);
      console.log('Clicked attendance cell for:', row.querySelector('td a').textContent.trim());
    }, 10);
  }
}
