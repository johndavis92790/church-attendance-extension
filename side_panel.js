document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const authorizeButton = document.getElementById('authorize-button');
  const sheetInfoText = document.getElementById('sheet-info');
  const attendanceContainer = document.getElementById('attendance-container');
  const extractContainer = document.getElementById('extract-container');
  const applyAttendanceButton = document.getElementById('apply-attendance-button');
  const resetButton = document.getElementById('reset-button');
  const statusDiv = document.getElementById('status');
  const extractedNamesDiv = document.getElementById('extracted-names');
  const paginationInfoDiv = document.getElementById('pagination-info');
  
  // Stats elements
  const currentPageCountElement = document.getElementById('current-page-count');
  const newlyAddedCountElement = document.getElementById('newly-added-count');
  const totalUniqueCountElement = document.getElementById('total-unique-count');
  
  // Hardcoded values
  const spreadsheetId = '1GcL6fnfT2VoXqQOyVEcD2gsW2wl87HC6TcikJ89RIps';
  const sheetName = 'attendance test 2';
  
  // Check if already authorized and initialize UI
  initializeUI();
  
  function initializeUI() {
    chrome.storage.local.get(['token', 'attendanceData'], function(data) {
      if (data.token) {
        // Update button text for re-auth case
        authorizeButton.textContent = 'Re-connect & Load Attendance Data';
        sheetInfoText.classList.remove('hidden');
        
        // If we already have attendance data, show the attendance and extract containers
        if (data.attendanceData && data.attendanceData.length > 0) {
          showAttendanceForm();
          showExtractForm();
        }
      }
    });
  }
  
  // Event listeners
  authorizeButton.addEventListener('click', authorizeAndLoadData);
  applyAttendanceButton.addEventListener('click', applyAttendance);
  document.getElementById('extract-names-button').addEventListener('click', extractNames);
  document.getElementById('send-to-sheets-button').addEventListener('click', sendNamesToSheets);
  resetButton.addEventListener('click', resetExtension);
  
  function authorizeAndLoadData() {
    showStatus('Connecting to Google and loading data...', 'loading');
    chrome.runtime.sendMessage({ action: 'authorize' }, function(response) {
      if (response && response.token) {
        // Successfully authorized, now load the sheet data
        sheetInfoText.classList.remove('hidden');
        authorizeButton.textContent = 'Re-connect & Load Attendance Data';
        
        // Immediately load data from the sheet
        loadSheetData();
      } else {
        showStatus('Authorization failed. Please try again.', 'error');
      }
    });
  }
  
  function loadSheetData() {
    showStatus('Loading attendance data...', 'loading');
    chrome.runtime.sendMessage({ 
      action: 'fetchSheetData', 
      spreadsheetId: spreadsheetId, 
      sheetName: sheetName 
    }, function(response) {
      if (response && response.data) {
        renderAttendanceData(response.data);
        showAttendanceForm();
        showExtractForm();
        showStatus('Connected and loaded attendance data successfully!', 'success');
      } else {
        showStatus('Failed to load attendance data. Please try again.', 'error');
      }
    });
  }
  
  function renderAttendanceData(data) {
    const memberCount = data.length;
    showStatus(`Loaded attendance data for ${memberCount} members.`, 'success');
    
    // Store attendance data
    chrome.storage.local.set({ 'attendanceData': data });
  }
  
  function applyAttendance() {
    showStatus('Applying attendance data...', 'loading');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        showStatus('No active tab found. Please make sure you are on the church attendance page.', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      chrome.tabs.sendMessage(activeTab.id, { action: 'applyAttendance' }, function(response) {
        if (chrome.runtime.lastError) {
          // Handle error when content script is not ready
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js']
          }, function() {
            // Retry sending message after content script is loaded
            setTimeout(function() {
              chrome.tabs.sendMessage(activeTab.id, { action: 'applyAttendance' }, function(response) {
                handleAttendanceResponse(response);
              });
            }, 500);
          });
        } else {
          handleAttendanceResponse(response);
        }
      });
    });
  }
  
  function handleAttendanceResponse(response) {
    if (response && response.success) {
      showStatus(response.message || 'Attendance applied successfully!', 'success');
    } else {
      showStatus(
        response && response.error 
          ? `Error: ${response.error}` 
          : 'Failed to apply attendance data.',
        'error'
      );
    }
  }
  
  function resetExtension() {
    showStatus('Resetting extracted names...', 'loading');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        showStatus('No active tab found.', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      chrome.tabs.sendMessage(activeTab.id, { action: 'resetExtraction' }, function(response) {
        if (chrome.runtime.lastError) {
          // Handle error when content script is not ready
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js']
          }, function() {
            // Retry after content script is loaded
            setTimeout(function() {
              chrome.tabs.sendMessage(activeTab.id, { action: 'resetExtraction' }, function(response) {
                handleResetResponse(response);
              });
            }, 500);
          });
        } else {
          handleResetResponse(response);
        }
      });
    });
  }
  
  function handleResetResponse(response) {
    if (response && response.success) {
      // Clear the UI
      extractedNamesDiv.innerHTML = '';
      paginationInfoDiv.textContent = '';
      currentPageCountElement.textContent = '0';
      newlyAddedCountElement.textContent = '0';
      totalUniqueCountElement.textContent = '0';
      showStatus('Extracted names have been reset.', 'success');
    } else {
      showStatus('Failed to reset extracted names.', 'error');
    }
  }
  
  function extractNames() {
    showStatus('Extracting names...', 'loading');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        showStatus('No active tab found. Please make sure you are on the church attendance page.', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      chrome.tabs.sendMessage(activeTab.id, { action: 'extractNames' }, function(response) {
        if (chrome.runtime.lastError) {
          // Handle error when content script is not ready
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js']
          }, function() {
            // Retry after content script is loaded
            setTimeout(function() {
              chrome.tabs.sendMessage(activeTab.id, { action: 'extractNames' }, function(response) {
                handleExtractResponse(response);
              });
            }, 500);
          });
        } else {
          handleExtractResponse(response);
        }
      });
    });
  }
  
  function handleExtractResponse(response) {
    if (response && response.success) {
      const names = response.names || [];
      
      // Update stats
      currentPageCountElement.textContent = response.currentPageCount || 0;
      newlyAddedCountElement.textContent = response.newlyAddedCount || 0;
      totalUniqueCountElement.textContent = response.totalUniqueCount || 0;
      
      // Display pagination info if available
      if (response.pageInfo) {
        paginationInfoDiv.textContent = response.pageInfo.message || '';
      } else {
        paginationInfoDiv.textContent = '';
      }
      
      // Display the names
      renderNames(names);
      
      showStatus(
        response.message || `Extracted ${names.length} names successfully!`,
        'success'
      );
    } else {
      showStatus(
        response && response.error 
          ? `Error: ${response.error}` 
          : 'Failed to extract names.',
        'error'
      );
    }
  }
  
  function renderNames(names) {
    if (!names || names.length === 0) {
      extractedNamesDiv.innerHTML = '<p>No names found.</p>';
      return;
    }
    
    // Sort names alphabetically
    names.sort((a, b) => a.name.localeCompare(b.name));
    
    // Create HTML content
    let html = '';
    names.forEach(member => {
      const genderInfo = member.gender ? ` (${member.gender})` : '';
      html += `<div class="name-item">${member.name}${genderInfo}</div>`;
    });
    
    extractedNamesDiv.innerHTML = html;
  }
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.classList.remove('hidden');
    
    // Hide status after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 5000);
    }
  }
  

  
  function showAttendanceForm() {
    attendanceContainer.classList.remove('hidden');
  }
  
  function showExtractForm() {
    extractContainer.classList.remove('hidden');
  }
  
  function sendNamesToSheets() {
    showStatus('Preparing to send names to Google Sheets...', 'loading');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        showStatus('No active tab found. Please make sure you are on the church attendance page.', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      // First, get the extracted names from the content script
      chrome.tabs.sendMessage(activeTab.id, { action: 'getExtractedNames' }, function(response) {
        if (chrome.runtime.lastError) {
          // Handle error when content script is not ready
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js']
          }, function() {
            // Retry sending message after content script is loaded
            setTimeout(function() {
              chrome.tabs.sendMessage(activeTab.id, { action: 'getExtractedNames' }, function(response) {
                handleGetNamesResponse(response);
              });
            }, 500);
          });
        } else {
          handleGetNamesResponse(response);
        }
      });
    });
  }
  
  function handleGetNamesResponse(response) {
    if (response && response.success && response.names && response.names.length > 0) {
      const names = response.names;
      showStatus(`Sending ${names.length} names to Google Sheets...`, 'loading');
      
      // Send the names to background script for uploading to Google Sheets
      chrome.runtime.sendMessage({
        action: 'updateSheetWithNames',
        names: names
      }, function(response) {
        if (response && response.success) {
          showStatus(response.message || `Successfully added ${response.newNames ? response.newNames.length : 'new'} names to Google Sheets.`, 'success');
        } else {
          showStatus(
            response && response.error 
              ? `Error: ${response.error}` 
              : 'Failed to update Google Sheets.',
            'error'
          );
        }
      });
    } else {
      showStatus(
        response && response.error 
          ? `Error: ${response.error}` 
          : 'No names available to send to Google Sheets.',
        'error'
      );
    }
  }
});
