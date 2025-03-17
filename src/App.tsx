import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Send, Upload, Loader2, Database, Download, Trash2 } from 'lucide-react';

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

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const GROQ_API_KEY = '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';
  const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

  const prepareDataForAnalysis = (data: any[]) => {
    const columns = Object.keys(data[0] || {});
    const sampleSize = 5;
    const firstRows = data.slice(0, sampleSize);
    const lastRows = data.slice(-sampleSize);
    const totalRows = data.length;

    return {
      columns,
      totalRows,
      sampleData: [...firstRows, ...lastRows],
      summary: `Dataset contains ${totalRows} rows with columns: ${columns.join(', ')}`,
    };
  };

  const formatResponse = (response: string) => {
    // Add bold headings and proper spacing
    return response
      .replace(/(\d+\.\s+[A-Za-z\s-]+:)/g, '<strong>$1</strong>') // Bold headings
      .replace(/(\n)/g, '<br />') // Add line breaks
      .replace(/(\d+\.\s+)/g, '<br /><strong>$1</strong>'); // Add spacing before numbered points
  };

  const chatWithExcel = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!excelData || !query) return;

    setLoading(true);
    const currentQuery = query;
    setQuery(''); // Clear the input field immediately

    try {
      const analyzableData = prepareDataForAnalysis(excelData.data);

      // Truncate or summarize data to avoid token limit issues
      const truncatedData = JSON.stringify(analyzableData.sampleData, null, 2).slice(0, 2000); // Limit to 2000 characters

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that analyzes Excel data. Provide clear, concise insights based on the available data sample. Format your response with bold headings, bullet points, and proper spacing for better readability.',
            },
            {
              role: 'user',
              content: `Analyze this Excel data:
                Summary: ${analyzableData.summary}
                Sample data: ${truncatedData}
                
                Query: ${currentQuery}
                
                Note: This is a sample of the full dataset. Please provide insights based on the available data and mention this limitation in your analysis.`,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to get response from API');
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }

      const responseText = data.choices[0].message.content;

      // Format the response
      const formattedResponse = formatResponse(responseText);

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Excel Chat Analysis</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFileDrawerOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
            >
              <Database className="w-5 h-5" />
            </button>
            <button
              onClick={exportChatHistory}
              className="p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
              title="Export chat history"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={clearChatHistory}
              className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
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
          <div className="bg-white w-4/5 max-w-sm h-full p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">File Selection</h2>
              <button
                onClick={() => setIsFileDrawerOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700"
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
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Files
                  </label>
                </div>
              </label>

              {excelFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="font-medium text-gray-700">Files:</div>
                  {excelFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div
                        className={`flex-1 truncate ${selectedFile === file.name ? 'font-semibold text-blue-600' : ''}`}
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
                        className="text-gray-500 hover:text-red-600 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {excelData && (
                    <div className="space-y-2">
                      <div className="font-medium text-gray-700">Sheet:</div>
                      <select
                        value={selectedSheet}
                        onChange={handleSheetChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
        <div className="hidden md:block md:w-64 lg:w-72 bg-white shadow-md p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Files</h2>
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
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Files
                </label>
              </div>
            </label>

            {excelFiles.length > 0 && (
              <div className="space-y-3">
                <div className="font-medium text-gray-700">Files:</div>
                {excelFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div
                      className={`flex-1 truncate cursor-pointer ${selectedFile === file.name ? 'font-semibold text-blue-600' : ''}`}
                      onClick={() => {
                        setSelectedFile(file.name);
                        readExcelFile(file);
                      }}
                    >
                      {file.name}
                    </div>
                    <button
                      onClick={() => removeFile(file.name)}
                      className="text-gray-500 hover:text-red-600 ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {excelData && (
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Sheet:</div>
                    <select
                      value={selectedSheet}
                      onChange={handleSheetChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
            <div className="p-4 bg-white border-b border-gray-200">
              <h2 className="text-lg font-semibold mb-4">Data Preview</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead>
                    <tr>
                      {Object.keys(excelData.data[0] || {}).map((key) => (
                        <th key={key} className="px-4 py-2 border border-gray-200 bg-gray-100 text-left text-sm font-semibold text-gray-700">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.data.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, i) => (
                          <td key={i} className="px-4 py-2 border border-gray-200 text-sm text-gray-700">
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
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {chatHistory.map((chat, index) => (
              <div key={index} className="space-y-2">
                {/* User query */}
                <div className="flex justify-end">
                  <div className="bg-blue-100 text-blue-900 rounded-lg p-3 max-w-[80%]">
                    <p>{chat.query}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {chat.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Assistant response */}
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 rounded-lg p-3 max-w-[80%]">
                    <p
                      dangerouslySetInnerHTML={{
                        __html: chat.response,
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {chat.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <form onSubmit={chatWithExcel} className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about your Excel data..."
                className="flex-1 p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={1}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query}
                className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
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