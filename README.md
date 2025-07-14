# Church Attendance Extension

This Chrome extension helps you update church attendance records on your church's website using data from a Google Sheet.

## Features

- Connect to Google Sheets to fetch attendance data
- Automatically mark attendance checkboxes on the church website
- Save your Google Sheet ID and name for future use
- Easy-to-use interface

## Setup Instructions

### 1. Set Up Your Google Sheet

Your Google Sheet should be structured as follows:
- First column: Member names (exactly as they appear on the church website)
- Header row: Dates in the format displayed on the website (e.g., "15 Jun")
- Cell values: Use "present" (or any value you choose) to indicate attendance

Example:
```
Name       | 15 Jun | 22 Jun | 29 Jun
-----------------------------------------
Smith, John | present|        | present
Doe, Jane  | present| present|        
```

### 2. Set Up Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Sheets API
4. Configure the OAuth consent screen
5. Create OAuth 2.0 credentials
6. Add your Client ID to the manifest.json file

### 3. Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top right
3. Click "Load unpacked" and select the extension directory
4. The extension icon should appear in your toolbar

## Usage

1. Navigate to your church's attendance page
2. Click the extension icon in your toolbar
3. Click "Connect to Google Sheets" to authorize
4. Enter your Google Sheet ID and Sheet name
5. Click "Load Attendance Data" to fetch the data
6. Click "Apply Attendance Data" to update the attendance on the page

## Troubleshooting

- Make sure member names in your spreadsheet match the names on the website
- Check that date formats match between the spreadsheet and website
- If authorization fails, verify your Google API credentials are correct
- If no changes occur, check the browser console for error messages

## Privacy

This extension requires access to:
- The active tab to update attendance checkboxes
- Google Sheets API to read your attendance data
- Chrome storage to save your preferences

No data is sent to any third-party servers.
