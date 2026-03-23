const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'dodey', 'Documents', 'src', 'Contract_sla_tracker', 'Copy of CCJ - VENDOR CONTRACTS REGISTER AS OF OCTOBER 2025.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Use array of arrays
    
    if (data.length > 0) {
       // Display first 5 rows to identify headers
       console.log(JSON.stringify(data.slice(0, 5), null, 2));
    }
  });
} catch (err) {
  console.error('Error reading Excel:', err);
}
