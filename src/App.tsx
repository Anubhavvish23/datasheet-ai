import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Send, Upload, Loader2, Database, Download, Trash2, Sun, Moon } from 'lucide-react';

interface ExcelData {
  sheets: string[];
  data: any[];
  fileName: string;
}

interface ChatMessage {
  query: string;
  response: string;
  timestamp: Date;
}

function App() {
  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isFileDrawerOpen, setIsFileDrawerOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setExcelFiles((prev) => [...prev, ...files]);
      if (files.length > 0) {
        setSelectedFile(files[0].name);
        readExcelFile(files[0]);
      }
      setIsFileDrawerOpen(false); // Close drawer after upload
    }
  };

  const readExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheets = workbook.SheetNames;

      if (sheets.length > 0) {
        const firstSheet = sheets[0];
        setSelectedSheet(firstSheet);
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);

        setExcelData({
          sheets,
          data: sheetData,
          fileName: file.name,
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSheetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedSheet = e.target.value;
    setSelectedSheet(selectedSheet);

    const file = excelFiles.find((f) => f.name === selectedFile);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet]);

        setExcelData((prev) => ({
          ...prev!,
          data: sheetData,
        }));
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const fileName = e.target.value;
    setSelectedFile(fileName);
    const file = excelFiles.find((f) => f.name === fileName);
    if (file) {
      readExcelFile(file);
    }
    setIsFileDrawerOpen(false); // Close drawer after selection
  };

  const searchExcelData = (query: string) => {
    if (!excelData || !query) return null;

    // Convert query to lowercase for case-insensitive search
    const searchTerm = query.toLowerCase();

    // Search through all columns for matching rows
    const matchingRows = excelData.data.filter((row) => {
      return Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm)
      );
    });

    return matchingRows;
  };

  const formatResponse = (rows: any[]) => {
    if (rows.length === 0) {
      return '<p>No matching data found in the Excel sheet.</p>';
    }

    // Create a table with the matching rows
    const columns = Object.keys(rows[0] || {});
    const tableHeaders = columns.map((col) => `<th class="px-4 py-2 bg-gray-100 dark:bg-gray-600">${col}</th>`).join('');
    const tableRows = rows.map((row) => {
      const cells = columns.map((col) => `<td class="px-4 py-2 border border-gray-200 dark:border-gray-600">${row[col]}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <p>Found ${rows.length} matching row(s):</p>
      <table class="min-w-full bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  };

  const chatWithExcel = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!excelData || !query) return;

    setLoading(true);
    const currentQuery = query;
    setQuery(''); // Clear the input field immediately

    try {
      // Search for matching rows in the Excel data
      const matchingRows = searchExcelData(currentQuery);

      // Format the response as a table
      const formattedResponse = formatResponse(matchingRows || []);

      setChatHistory((prev) => [
        ...prev,
        {
          query: currentQuery,
          response: formattedResponse,
          timestamp: new Date(),
        },
      ]);

      // Scroll to the bottom of the chat container
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        {
          query: currentQuery,
          response: `Error processing your request: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          timestamp: new Date(),
        },
      ]);
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (fileName: string) => {
    setExcelFiles((prev) => prev.filter((file) => file.name !== fileName));
    if (selectedFile === fileName) {
      const remainingFiles = excelFiles.filter((file) => file.name !== fileName);
      if (remainingFiles.length > 0) {
        setSelectedFile(remainingFiles[0].name);
        readExcelFile(remainingFiles[0]);
      } else {
        setSelectedFile('');
        setExcelData(null);
      }
    }
  };

  const exportChatHistory = () => {
    const exportData = chatHistory.map((chat) => ({
      query: chat.query,
      response: chat.response,
      timestamp: chat.timestamp.toISOString(),
    }));

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'excel-chat-history.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearChatHistory = () => {
    setChatHistory([]);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className={`bg-white shadow-sm py-4 px-4 sm:px-6 lg:px-8 ${isDarkMode ? 'dark:bg-gray-800' : ''}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Excel Chat Analysis</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
              title="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsFileDrawerOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-700 dark:text-blue-100"
            >
              <Database className="w-5 h-5" />
            </button>
            <button
              onClick={exportChatHistory}
              className="p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-700 dark:text-blue-100"
              title="Export chat history"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={clearChatHistory}
              className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-700 dark:text-red-100"
              title="Clear chat history"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer for file selection */}
      {isFileDrawerOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex">
          <div className="bg-white w-4/5 max-w-sm h-full p-4 overflow-y-auto dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold dark:text-gray-100">File Selection</h2>
              <button
                onClick={() => setIsFileDrawerOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
              >
                ✕
              </button>
            </div>
            {/* File upload controls */}
            <div className="space-y-4">
              <label className="block">
                <span className="sr-only">Choose Excel files</span>
                <div className="relative">
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx"
                    multiple
                    onChange={handleFileUpload}
                    id="mobile-file-upload"
                  />
                  <label
                    htmlFor="mobile-file-upload"
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Files
                  </label>
                </div>
              </label>

              {excelFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="font-medium text-gray-700 dark:text-gray-200">Files:</div>
                  {excelFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded dark:bg-gray-700">
                      <div
                        className={`flex-1 truncate ${selectedFile === file.name ? 'font-semibold text-blue-600 dark:text-blue-300' : 'dark:text-gray-200'}`}
                        onClick={() => {
                          setSelectedFile(file.name);
                          readExcelFile(file);
                          setIsFileDrawerOpen(false);
                        }}
                      >
                        {file.name}
                      </div>
                      <button
                        onClick={() => removeFile(file.name)}
                        className="text-gray-500 hover:text-red-600 ml-2 dark:text-gray-300 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {excelData && (
                    <div className="space-y-2">
                      <div className="font-medium text-gray-700 dark:text-gray-200">Sheet:</div>
                      <select
                        value={selectedSheet}
                        onChange={handleSheetChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      >
                        {excelData.sheets.map((sheet, index) => (
                          <option key={index} value={sheet}>
                            {sheet}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left sidebar - File selection (hidden on mobile) */}
        <div className={`hidden md:block md:w-64 lg:w-72 bg-white shadow-md p-4 overflow-y-auto dark:bg-gray-800`}>
          <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Files</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="sr-only">Choose Excel files</span>
              <div className="relative">
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx"
                  multiple
                  onChange={handleFileUpload}
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Files
                </label>
              </div>
            </label>

            {excelFiles.length > 0 && (
              <div className="space-y-3">
                <div className="font-medium text-gray-700 dark:text-gray-200">Files:</div>
                {excelFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded dark:bg-gray-700">
                    <div
                      className={`flex-1 truncate cursor-pointer ${selectedFile === file.name ? 'font-semibold text-blue-600 dark:text-blue-300' : 'dark:text-gray-200'}`}
                      onClick={() => {
                        setSelectedFile(file.name);
                        readExcelFile(file);
                      }}
                    >
                      {file.name}
                    </div>
                    <button
                      onClick={() => removeFile(file.name)}
                      className="text-gray-500 hover:text-red-600 ml-2 dark:text-gray-300 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {excelData && (
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700 dark:text-gray-200">Sheet:</div>
                    <select
                      value={selectedSheet}
                      onChange={handleSheetChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    >
                      {excelData.sheets.map((sheet, index) => (
                        <option key={index} value={sheet}>
                          {sheet}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Data Preview */}
          {excelData && (
            <div className={`p-4 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700`}>
              <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Data Preview</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
                  <thead>
                    <tr>
                      {Object.keys(excelData.data[0] || {}).map((key) => (
                        <th key={key} className="px-4 py-2 border border-gray-200 bg-gray-100 text-left text-sm font-semibold text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.data.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, i) => (
                          <td key={i} className="px-4 py-2 border border-gray-200 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Chat history */}
          <div
            ref={chatContainerRef}
            className={`flex-1 overflow-y-auto p-4 space-y-4 dark:bg-gray-900`}
          >
            {chatHistory.map((chat, index) => (
              <div key={index} className="space-y-2">
                {/* User query */}
                <div className="flex justify-end">
                  <div className="bg-blue-100 text-blue-900 rounded-lg p-3 max-w-[80%] dark:bg-blue-700 dark:text-blue-100">
                    <p>{chat.query}</p>
                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-300">
                      {chat.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Assistant response */}
                <div className="flex justify-start">
                  <div
                    className="bg-gray-100 text-gray-900 rounded-lg p-3 max-w-[80%] dark:bg-gray-700 dark:text-gray-200"
                    dangerouslySetInnerHTML={{
                      __html: chat.response,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className={`border-t border-gray-200 p-4 bg-white dark:bg-gray-800 dark:border-gray-700`}>
            <form onSubmit={chatWithExcel} className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about your Excel data..."
                className="flex-1 p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                rows={1}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query}
                className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;