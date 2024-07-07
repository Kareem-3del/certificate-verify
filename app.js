const express = require('express');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const db = new sqlite3.Database(':memory:');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

// Create certificates directory
if (!fs.existsSync('certificates')) {
    fs.mkdirSync('certificates');
}

// Create table for certificates
db.serialize(() => {
    db.run("CREATE TABLE certificates (id TEXT PRIMARY KEY, name TEXT, qr TEXT)");
});

// Route to generate certificate
app.post('/generate', async (req, res) => {
    const { name } = req.body;
    console.log("Name received:", name); // Add this line
    const id = Date.now().toString();
    const qrText = `${process.env.BASE_URL}/verify/${id}`; // Use BASE_URL from .env

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(qrText);

    // Create PDF document
    const doc = new PDFDocument();
    const filePath = path.join(__dirname, 'certificates', `${id}.pdf`);

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    doc.fontSize(25).text('Certificate of Completion', { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).text(`This is to certify that ${name} has successfully completed the course.`, {
        align: 'center'
    });
    doc.fontSize(14).text(`This is only Example For Certificate`, {
        align: 'center'
    });
    doc.image(qrCodeDataUrl, {
        fit: [100, 100],
        align: 'center',
        valign: 'center'
    });
    doc.end();

    // Listen for the 'finish' event to ensure the file is completely written
    writeStream.on('finish', () => {
        // Save certificate data to the database
        db.run("INSERT INTO certificates (id, name, qr) VALUES (?, ?, ?)", [id, name, qrCodeDataUrl], (err) => {
            if (err) {
                res.status(500).send("Error saving certificate.");
                return;
            }
            // Send the certificate URL

            res.send(`
           <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate Generator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }

        .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 100%;
            text-align: center;
        }

        h1 {
            margin-bottom: 20px;
            color: #333;
        }

        form {
            display: flex;
            flex-direction: column;
        }

        label {
            margin-bottom: 5px;
            font-weight: bold;
            text-align: left;
        }

        input[type="text"] {
            padding: 10px;
            margin-bottom: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }

        button {
            padding: 10px;
            background-color: #28a745;
            border: none;
            border-radius: 5px;
            color: #fff;
            cursor: pointer;
            font-size: 16px;
        }

        button:hover {
            background-color: #218838;
        }

        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>
<body>
<div class="container">
    <h1>Certificated Generated</h1>
    <p>Your certificate has been generated successfully.</p>
    <p><a href="${process.env.BASE_URL}/download/${id}" download>Download Certificate</a></p>
    <div class="footer">
        <p>Verify your certificate <a href="${process.env.BASE_URL}/verify/${id}">click here</a> or scan QR</p>
        <img src="${qrCodeDataUrl}" alt="QR Code">
    </div>
</div>
</body>
</html>
            `);
        });
    });

    writeStream.on('error', (err) => {
        res.status(500).send("Error writing file.");
    });
});

// Route to download certificate
app.get('/download/:id', (req, res) => {
    const { id } = req.params;

    db.get("SELECT * FROM certificates WHERE id = ?", [id], (err, row) => {
        if (err) {
            res.status(500).send("Error downloading certificate.");
            return;
        }

        if (!row) {
            res.status(404).send("Certificate not found.");
            return;
        }

        const filePath = path.join(__dirname, 'certificates', `${id}.pdf`);
        res.download(filePath);
    });
});

// Route to verify certificate
app.get('/verify/:id', (req, res) => {
    const { id } = req.params;

    db.get("SELECT * FROM certificates WHERE id = ?", [id], (err, row) => {
        if (err) {
            res.status(500).send("Error verifying certificate.");
            return;
        }

        if (!row) {
            res.status(404).send("Certificate not found.");
            return;
        }

        res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate Verification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }

          .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 100%;
            text-align: center;
          }

          h1 {
            margin-bottom: 20px;
            color: #333;
          }

          .certificate-info {
            margin-bottom: 20px;
            text-align: left;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            background-color: #f9f9f9;
          }

          img {
            margin-top: 20px;
            max-width: 100%;
          }

          .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Certificate Verification</h1>
          <div class="certificate-info">
            <p><strong>Name:</strong> ${row.name}</p>
            <p><strong>Certificate ID:</strong> ${id}</p>
          </div>
          <img src="${row.qr}" alt="QR Code">
          <div class="footer">
            <p><a href="https://github.com/Kareem-3del">Kareem Adel</a></p>
            <p>Whatsapp/Phone <a href="tel:+201142780644"> +201142780644</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
    });
});

const PORT = process.env.PORT || 4000; // Use PORT from .env or default to 4000
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
