document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const authorizeButton = document.getElementById('authorize-button');
  const sheetContainer = document.getElementById('sheet-container');
  const loadSheetButton = document.getElementById('load-sheet-button');
  const attendanceContainer = document.getElementById('attendance-container');
  const applyAttendanceButton = document.getElementById('apply-attendance-button');
  const resetButton = document.getElementById('reset-button');
  const statusDiv = document.getElementById('status');
  
  // Hardcoded values
  const spreadsheetId = '1GcL6fnfT2VoXqQOyVEcD2gsW2wl87HC6TcikJ89RIps';
  const sheetName = 'attendance test';
  
  // Check if already authorized
  chrome.storage.local.get(['token', 'spreadsheetId', 'sheetName'], function(data) {
    if (data.token) {
      showSheetForm();
      
      if (data.spreadsheetId) {
        spreadsheetIdInput.value = data.spreadsheetId;
      }
      
      if (data.sheetName) {
        sheetNameInput.value = data.sheetName;
      }
    }
  });
  
  // Event listeners
  authorizeButton.addEventListener('click', authorize);
  loadSheetButton.addEventListener('click', loadSheetData);
  applyAttendanceButton.addEventListener('click', applyAttendance);
  resetButton.addEventListener('click', resetExtension);
  
  function authorize() {
    showStatus('Connecting to Google...', 'loading');
    chrome.runtime.sendMessage({ action: 'authorize' }, function(response) {
      if (response && response.token) {
        showSheetForm();
        showStatus('Connected to Google!', 'success');
      } else {
        showStatus('Authorization failed. Please try again.', 'error');
      }
    });
  }
  
  function showSheetForm() {
    document.getElementById('auth-container').classList.add('hidden');
    sheetContainer.classList.remove('hidden');
  }
  
  function loadSheetData() {
    showStatus('Loading attendance data...', 'loading');
    
    // Save the sheet info
    chrome.storage.local.set({
      'spreadsheetId': spreadsheetId,
      'sheetName': sheetName
    });
    
    chrome.runtime.sendMessage({
      action: 'getSheetData',
      spreadsheetId: spreadsheetId,
      sheetName: sheetName
    }, function(response) {
      if (response && response.success) {
        attendanceContainer.classList.remove('hidden');
        showStatus('Attendance data loaded successfully!', 'success');
      } else {
        showStatus('Failed to load data: ' + (response ? response.error : 'Unknown error'), 'error');
      }
    });
  }
  
  function applyAttendance() {
    showStatus('Applying attendance data...', 'loading');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        showStatus('No active tab found', 'error');
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'applyAttendance' }, function(response) {
        if (response && response.success) {
          showStatus('Attendance applied successfully!', 'success');
        } else {
          showStatus('Failed to apply attendance: ' + (response ? response.error : 'Unknown error'), 'error');
        }
      });
    });
  }
  
  function resetExtension() {
    chrome.storage.local.clear(function() {
      showStatus('Extension reset. Please reconnect to Google Sheets.', 'loading');
      document.getElementById('auth-container').classList.remove('hidden');
      sheetContainer.classList.add('hidden');
      attendanceContainer.classList.add('hidden');
      spreadsheetIdInput.value = '';
      sheetNameInput.value = '';
    });
  }
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.classList.remove('hidden');
    
    if (type !== 'loading') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 5000);
    }
  }
});
