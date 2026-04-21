// Generates minimal but valid PDFs with WinAnsiEncoding for text extraction
const fs = require('fs');

function makePdf(text) {
  const safe = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 12 Tf 50 750 Td (${safe}) Tj ET`;
  const streamLen = Buffer.byteLength(stream);

  const lines = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj',
    '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>endobj',
    `5 0 obj<</Length ${streamLen}>>`,
    'stream',
    stream,
    'endstream',
    'endobj',
  ];

  const header = lines.join('\n') + '\n';
  const offsets = [];
  let pos = 0;
  for (const line of lines) {
    if (/^\d+ 0 obj/.test(line)) offsets.push(pos);
    pos += Buffer.byteLength(line) + 1;
  }

  const xref = [
    'xref',
    `0 6`,
    '0000000000 65535 f ',
    ...offsets.map(o => o.toString().padStart(10, '0') + ' 00000 n '),
  ].join('\n');

  const trailer = `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${pos}\n%%EOF`;
  return header + xref + '\n' + trailer;
}

fs.writeFileSync('baseline.pdf', makePdf('Invoice 2024 Total 1000 EUR Client Acme Corp'));
fs.writeFileSync('modified.pdf', makePdf('Invoice 2024 Total 1200 EUR Client Acme Corp'));
fs.writeFileSync('identical.pdf', makePdf('Invoice 2024 Total 1000 EUR Client Acme Corp'));
console.log('fixtures created');
