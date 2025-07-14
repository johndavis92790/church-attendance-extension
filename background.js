// Handle extension installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Church Attendance Extension installed');
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'authorize') {
    authorizeUser(sendResponse);
    return true; // Keep the message channel open for async response
  } else if (request.action === 'getSheetData') {
    fetchSheetData(request.spreadsheetId, request.sheetName, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Function to authorize with Google
function authorizeUser(sendResponse) {
  chrome.identity.getAuthToken({ interactive: true }, function(token) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    
    if (token) {
      // Store token
      chrome.storage.local.set({ 'token': token });
      sendResponse({ success: true, token: token });
    } else {
      sendResponse({ success: false, error: 'Failed to get auth token' });
    }
  });
}

// Function to fetch data from Google Sheet
function fetchSheetData(spreadsheetId, sheetName, sendResponse) {
  chrome.storage.local.get('token', function(data) {
    if (!data.token) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
    
    // Fetch the spreadsheet data using Google Sheets API
    const range = `${sheetName}!A:Z`; // Get all data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    
    fetch(url, {
      headers: {
        Authorization: `Bearer ${data.token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data.values || data.values.length === 0) {
        sendResponse({ success: false, error: 'No data found in sheet' });
        return;
      }
      
      // Process the sheet data
      const processedData = processSheetData(data.values);
      
      // Store processed data
      chrome.storage.local.set({ 'attendanceData': processedData });
      
      sendResponse({ success: true, data: processedData });
    })
    .catch(error => {
      console.error('Error fetching sheet data:', error);
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
      name: row[0] // First column is member name
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
          const month = dateObj.toLocaleString('en-US', { month: 'short' });
          const formattedDate = `${day} ${month}`;
          
          // Determine attendance status from TRUE/FALSE values
          if (row[j] && row[j].toString().toUpperCase() === 'TRUE') {
            memberData[formattedDate] = 'present';
          } else {
            memberData[formattedDate] = 'absent';
          }
        } else {
          // If date parsing fails, use the original header
          memberData[headers[j]] = (row[j] && row[j].toString().toUpperCase() === 'TRUE') ? 'present' : 'absent';
        }
      }
    }
    
    result.push(memberData);
  }
  
  return result;
}
