/* global process */
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import connectDB from './db.js';
import Application from './models/Application.js';
import User from './models/User.js';
import Programme from './models/Programme.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

// Connect to MongoDB
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 🚀 Seed Initial Data
const seedDatabase = async () => {
  try {
    // 1. Seed Admin
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      console.log("🛠️ Seeding Admin account...");
      await User.create({
        name: "Admin (IBES)",
        email: "aemannaik.official@gmail.com",
        password: "123456",
        role: "admin"
      });
    }

    // 2. Seed Programmes
    const programmeCount = await Programme.countDocuments();
    if (programmeCount === 0) {
      console.log("🛠️ Seeding Default Programmes...");
      const DEFAULT_PROGRAMMES = [
        "Doctor of Business Administration (DBA) Mixed Mode",
        "Doctor of Business Administration by (Research)",
        "Doctor of Education (EdD) Mixed Mode",
        "Doctor of Education (EdD) Research Mode",
        "Mastère TESOL",
        "Master of Business Administration",
        "Master of Education - M.Ed",
        "Bachelors of Arts(Hons) in Business Administration",
        "Bachelor of Arts in Education",
        "Bachelor of Science (Hons) in Computer Science"
      ];
      await Programme.insertMany(DEFAULT_PROGRAMMES.map(name => ({ name })));
    }
  } catch (err) {
    console.error("❌ Seeding Error:", err.message);
  }
};
seedDatabase();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Endpoint: Multi-file Upload
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ success: true, urls: fileUrls });
  } catch (err) {
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

const PORT = process.env.PORT || 5000;

// Staff Name to Email mapping for notifications
const STAFF_EMAILS = {
  "Dr. Sarah Collins": "sarah@gmail.com",
  "Dr. Alice Thompson": "alice@gmail.com",
  "Dr. Emily Watson": "emily@gmail.com",
  "Prof. James Miller": "james@gmail.com",
  "Prof. Robert Reed": "robert@gmail.com",
  "Dr. Kevin Zhang": "kevin@gmail.com",
  "Prof. Linda Wu": "linda@gmail.com",
  "IBES Admin": "aemannaik.official@gmail.com",
  "Learning Center": "learningcenter@ibes.fr"
};

// Configure Nodemailer with the Admin's Gmail Credentials
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Endpoint: Notify Programme Leader via Email (Step 2 -> Step 3)
app.post('/api/notify-leader', async (req, res) => {
  const { leaderName, applicantName, programmeName } = req.body;

  if (!leaderName || !applicantName) {
    return res.status(400).json({ error: "Leader name and Applicant name are required." });
  }

  const recipientEmail = STAFF_EMAILS[leaderName];
  if (!recipientEmail) {
    return res.status(404).json({ error: `Email not found for leader: ${leaderName}` });
  }

  const mailOptions = {
    from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `Action Required: New Academic Application - ${applicantName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; max-width: 600px; color: #333;">
        <h2 style="color: #673ab7; text-align: center;">IBES Academic Portal</h2>
        <p>Dear <strong>${leaderName}</strong>,</p>
        <p>A new application has been assigned to you for academic review.</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #673ab7;">
          <p><strong>Applicant:</strong> ${applicantName}</p>
          <p><strong>Programme:</strong> ${programmeName || "N/A"}</p>
        </div>
        <p>Please log in to the portal to provide your decision.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="http://localhost:5173" style="background-color: #673ab7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Portal</a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: `Notification email sent to ${leaderName}.` });
  } catch (error) {
    console.error("Mail Error:", error);
    res.status(500).json({ error: "Failed to send email.", details: error.message });
  }
});

// Endpoint: Notify Admin via Email (Step 3 -> Admin Dashboard)
app.post('/api/notify-admin', async (req, res) => {
  const { leaderName, applicantName, decision } = req.body;

  const mailOptions = {
    from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
    to: "aemannaik.official@gmail.com",
    subject: `Response Received: ${leaderName} has ${decision}ed an application`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; max-width: 600px; color: #333;">
        <h2 style="color: #673ab7;">Academic Decision Alert</h2>
        <p>Dear Admin,</p>
        <p>Programme Leader <strong>${leaderName}</strong> has submitted a decision:</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid ${decision === 'approve' ? '#1e8e3e' : '#d93025'};">
          <p><strong>Applicant:</strong> ${applicantName}</p>
          <p><strong>Decision:</strong> <span style="color: ${decision === 'approve' ? '#1e8e3e' : '#d93025'}; text-transform: uppercase; font-weight: bold;">${decision}</span></p>
        </div>
        <p>Please review this decision on your dashboard.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="http://localhost:5173" style="background-color: #673ab7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Dashboard</a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Admin notified successfully." });
  } catch (error) {
    console.error("Notify Admin Error:", error);
    res.status(500).json({ error: "Failed to notify admin.", details: error.message });
  }
});

// Endpoint: Notify Applicant upon successful form submission
app.post('/api/notify-applicant', async (req, res) => {
  const { applicantName, applicantEmail } = req.body;

  if (!applicantEmail) {
    return res.status(400).json({ error: "Applicant email is required for confirmation." });
  }

  const mailOptions = {
    from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
    to: applicantEmail,
    subject: `Application Received - IBES Academic Board`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; max-width: 600px; color: #333; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #673ab7; margin: 0;">Application Confirmed</h2>
          <p style="color: #777; font-size: 14px; margin-top: 5px;">IBES Professional Academic Registry</p>
        </div>
        <p>Dear <strong>${applicantName || "Applicant"}</strong>,</p>
        <p>Thank you for submitting your application form.</p>
        <div style="background-color: #f0fdf4; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #16a34a;">
          <p style="margin: 0;">We have successfully received your credentials and supporting documents. They are currently being queued for Stage 2 Administrative Review.</p>
        </div>
        <p>Someone from the administration team will carefully review your file and contact you shortly with the next steps.</p>
        <p>Best Regards,<br/><br/><strong>IBES Admissions Team</strong><br/><span style="color: #777; font-size: 12px;">This is an automated message. Please do not reply directly to this email.</span></p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Applicant Email Sent to:", applicantEmail, "ID:", info.messageId);
    res.json({ success: true, message: "Applicant confirmation email sent successfully." });
  } catch (error) {
    console.error("Notify Applicant Error:", error);
    res.status(500).json({ error: "Failed to notify applicant.", details: error.message });
  }
});

// Endpoint: Notify Admin immediately upon new application submission
app.post('/api/notify-admin-new', async (req, res) => {
  const { applicantName, applicationType } = req.body;

  const mailOptions = {
    from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
    to: "aemannaik.official@gmail.com",
    subject: `New Application Submitted: ${applicantName || 'Applicant'}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; max-width: 600px; color: #333;">
        <h2 style="color: #673ab7;">New Form Submission Alert</h2>
        <p>Dear Admin,</p>
        <p>A new ${applicationType || 'academic'} application has just been submitted into the registry.</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #673ab7;">
          <p style="margin:0 0 8px 0;"><strong>Applicant Name:</strong> ${applicantName || 'Not Required'}</p>
          <p style="margin:0;"><strong>Type:</strong> ${applicationType || 'General Form'}</p>
        </div>
        <p>Please log in to the admin portal to review this application.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="http://localhost:5173" style="background-color: #673ab7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Dashboard</a>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Admin New App Notification Sent:", info.messageId);
    res.json({ success: true, message: "Admin notified successfully of new application." });
  } catch (error) {
    console.error("Admin Notify Error:", error);
    res.status(500).json({ error: "Failed to notify admin.", details: error.message });
  }
});

// Endpoint: Send credentials to new Leader
app.post('/api/send-leader-credentials', async (req, res) => {
  const { name, email, password } = req.body;
  
  const mailOptions = {
    from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your IBES Portal Login Credentials",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; max-width: 600px; color: #333;">
        <h2 style="color: #673ab7; text-align: center;">Welcome to IBES Portal</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>Your account as a Programme Leader has been created. Use the following credentials to log in:</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #673ab7;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> <span style="font-family: monospace; font-weight: bold; font-size: 1.1em;">${password}</span></p>
        </div>
        <p>Please keep these credentials secure.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="http://localhost:5173" style="background-color: #673ab7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Access Portal</a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Credentials sent successfully." });
  } catch (error) {
    console.error("Mail Error:", error);
    res.status(500).json({ error: "Failed to send credentials email." });
  }
});

// Endpoint: Notify staff of new distributed Tutor form (Change 5)
app.post('/api/notify-form-distributed', async (req, res) => {
  const { applicantName, programmeName, recipientEmails } = req.body;
  
  const mailOptions = {
    from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
    to: recipientEmails.join(', '),
    subject: `New Tutor Application Submitted: ${applicantName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; max-width: 600px; color: #333;">
        <h2 style="color: #673ab7;">New Form Distribution Alert</h2>
        <p>A new Tutor/Supervisor application has been submitted for <strong>${programmeName}</strong>.</p>
        <p>Applicant: <strong>${applicantName}</strong></p>
        <p>You can now log in to the portal to review and download the full PDF application form.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="http://localhost:5173" style="background-color: #673ab7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Portal</a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Distribution notifications sent." });
  } catch (error) {
    console.error("Distribution Error:", error);
    res.status(500).json({ error: "Failed to send distribution notifications." });
  }
});

// Endpoint: Distribute 3 PDF approval copies via email (Step 3 → Final)
app.post('/api/distribute-approval-pdfs', async (req, res) => {
  const { app: appData, leaderName, pdfBase64, pdfBase64LC } = req.body;

  if (!appData || !leaderName) {
    return res.status(400).json({ error: "app data and leaderName are required." });
  }

  const safeName = (appData.fullName || 'Applicant').replace(/\s+/g, '_');

  const summaryText = `
IBES TUTOR/SUPERVISOR APPOINTMENT — OFFICIAL APPROVAL

Applicant: ${appData.fullName || 'N/A'}
Programme: ${appData.ibesprogrammes || 'N/A'}
Module(s): ${appData.ibesModules || 'N/A'}
Approved Centre: ${appData.approvedCentre || 'N/A'}
Approved by: ${leaderName}
Date: ${new Date().toLocaleDateString()}
  `.trim();

  // removed redundant results declaration

  // Helper to clean base64 string (strip data:application/pdf;base64, if present)
  const cleanBase64 = (str) => {
    if (!str) return null;
    if (str.includes(',')) return str.split(',')[1];
    return str;
  };

  const tutorPdf = cleanBase64(pdfBase64);
  const lcPdf = cleanBase64(pdfBase64LC);
  const mailJobs = [];

  // 1. Tutor Job
  const targetEmail = appData.workEmail || appData.email || appData.personalEmail;
  if (targetEmail) {
    const tutorMail = {
      from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
      to: targetEmail,
      subject: `[IBES] Your Tutor Appointment has been Approved`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #001f3f; padding: 20px 24px;">
            <img src="https://ibesuni.fr/portal/assets/emails/ibes.jpg" alt="IBES" style="height: 40px;" />
          </div>
          <div style="padding: 24px;">
            <p>Dear <strong>${appData.fullName || 'Applicant'}</strong>,</p>
            <p>Your Tutor/Supervisor appointment application has been <strong>approved</strong> by <strong>${leaderName}</strong>.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; white-space: pre-line; font-family: monospace;">${summaryText}</div>
            <p>Your official appointment letter is attached to this email as a PDF.</p>
            <p style="color: #64748b; font-size: 12px;">This is an automated notification from the IBES Academic Registry. Do not reply to this email.</p>
          </div>
        </div>
      `,
      attachments: tutorPdf ? [{ filename: `Approval_Tutor_Copy_${safeName}.pdf`, content: tutorPdf, encoding: 'base64', contentType: 'application/pdf' }] : []
    };
    mailJobs.push({ label: 'Tutor / Applicant', mail: tutorMail });
  }

  // 2. Admin Job
  const adminEmail = STAFF_EMAILS["IBES Admin"];
  if (adminEmail) {
    const adminMail = {
      from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `[IBES] Tutor Appointment Approved — ${appData.fullName || 'Applicant'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #001f3f; padding: 20px 24px;">
            <img src="https://ibesuni.fr/portal/assets/emails/ibes.jpg" alt="IBES" style="height: 40px;" />
          </div>
          <div style="padding: 24px;">
            <p>Dear Admin Team,</p>
            <p>The application for <strong>${appData.fullName || 'N/A'}</strong> has been <strong>approved</strong> by <strong>${leaderName}</strong>.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; white-space: pre-line; font-family: monospace;">${summaryText}</div>
            <p>Please log in to the portal to review the official record or download the PDF document on demand.</p>
          </div>
        </div>
      `,
      attachments: [] // Admin does not need PDF in email
    };
    mailJobs.push({ label: 'Admin Team', mail: adminMail });
  }

  // 3. Learning Centre Job
  const lcEmail = STAFF_EMAILS["Learning Center"];
  if (lcEmail) {
    const lcMail = {
      from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
      to: lcEmail,
      subject: `[IBES] Tutor Appointment Approved — ${appData.fullName || 'Applicant'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #001f3f; padding: 20px 24px;">
            <img src="https://ibesuni.fr/portal/assets/emails/ibes.jpg" alt="IBES" style="height: 40px;" />
          </div>
          <div style="padding: 24px;">
            <p>Dear Learning Centre,</p>
            <p>A new Tutor/Supervisor appointment for <strong>${appData.fullName || 'N/A'}</strong> has been approved by <strong>${leaderName}</strong>.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; white-space: pre-line; font-family: monospace;">${summaryText}</div>
            <p>The official appointment letter is attached as a PDF.</p>
          </div>
        </div>
      `,
      attachments: lcPdf ? [{ filename: `Approval_LearningCentre_Copy_${safeName}.pdf`, content: lcPdf, encoding: 'base64', contentType: 'application/pdf' }] : []
    };
    mailJobs.push({ label: 'Learning Centre', mail: lcMail });
  }

  // 4. Programme Leader Job
  const leaderEmail = STAFF_EMAILS[leaderName];
  if (leaderEmail) {
    const leaderMail = {
      from: `"IBES Registry" <${process.env.EMAIL_USER}>`,
      to: leaderEmail,
      subject: `[IBES] Confirmation: You Approved ${appData.fullName || 'Applicant'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #001f3f; padding: 20px 24px;">
            <img src="https://ibesuni.fr/portal/assets/emails/ibes.jpg" alt="IBES" style="height: 40px;" />
          </div>
          <div style="padding: 24px;">
            <p>Dear ${leaderName},</p>
            <p>This is a confirmation that you have approved the application for <strong>${appData.fullName || 'N/A'}</strong>.</p>
            <p>You can download the official record at any time from your dashboard.</p>
          </div>
        </div>
      `,
      attachments: [] // Leader can download from portal
    };
    mailJobs.push({ label: 'Programme Leader', mail: leaderMail });
  }

  // Execute all jobs in parallel
  const results = await Promise.all(mailJobs.map(async (job) => {
    try {
      await transporter.sendMail(job.mail);
      return { label: job.label, status: 'sent' };
    } catch (err) {
      console.error(`Failed to send ${job.label}:`, err.message);
      return { label: job.label, status: 'failed', error: err.message };
    }
  }));

  const allSent = results.every(r => r.status === 'sent');
  res.json({
    success: true,
    message: allSent ? "All distribution emails sent." : "Partial distribution — see results.",
    results: results
  });
});

// --- MONGODB ENDPOINTS: APPLICATIONS ---

// GET all applications
app.get('/api/applications', async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 });
    res.json(apps);
  } catch {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// POST new application
app.post('/api/applications', async (req, res) => {
  console.log("[BACKEND DEBUG] Received POST /api/applications:", req.body);
  try {
    const newApp = new Application(req.body);
    const savedApp = await newApp.save();
    console.log("[BACKEND DEBUG] Successfully saved application:", savedApp._id);
    res.json(savedApp);
  } catch (err) {
    console.error("[BACKEND DEBUG] Failed to save application:", err);
    res.status(500).json({ error: "Failed to save application", details: err.message });
  }
});

// PUT (update) application
app.put('/api/applications/:id', async (req, res) => {
  try {
    const updatedApp = await Application.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedApp);
  } catch {
    res.status(500).json({ error: "Failed to update application" });
  }
});

// DELETE application
app.delete('/api/applications/:id', async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete application" });
  }
});

// --- MONGODB ENDPOINTS: USERS (LEADERS/ADMIN) ---

// GET all leaders
app.get('/api/leaders', async (req, res) => {
  try {
    const leaders = await User.find({ role: 'leader' });
    res.json(leaders);
  } catch {
    res.status(500).json({ error: "Failed to fetch leaders" });
  }
});

// POST register leader
app.post('/api/leaders', async (req, res) => {
  try {
    const leaderData = { ...req.body, role: 'leader' };
    if (leaderData.email) leaderData.email = leaderData.email.toLowerCase();
    const user = new User(leaderData);
    const saved = await user.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: "Failed to register leader", details: err.message });
  }
});

// PUT update leader
app.put('/api/leaders/:email', async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.email) updateData.email = updateData.email.toLowerCase();
    const updated = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase() }, 
      updateData, 
      { new: true }
    );
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update leader" });
  }
});

// DELETE leader
app.delete('/api/leaders/:email', async (req, res) => {
  try {
    await User.findOneAndDelete({ email: req.params.email });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete leader" });
  }
});

// --- MONGODB ENDPOINTS: PROGRAMMES ---

app.get('/api/programmes', async (req, res) => {
  try {
    const progs = await Programme.find().sort({ name: 1 });
    res.json(progs.map(p => p.name));
  } catch {
    res.status(500).json({ error: "Failed to fetch programmes" });
  }
});

// --- MONGODB ENDPOINTS: AUTH ---

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    // Case-insensitive email search
    const user = await User.findOne({ 
      email: { $regex: new RegExp(`^${email.trim()}$`, 'i') }, 
      role 
    });
    
    if (user && user.password === password) { // In production, use bcrypt
      res.json({ success: true, name: user.name, role: user.role });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ error: "Auth error" });
  }
});

app.listen(PORT, () => {
  console.log(`[SERVER] IBES Notification Service running on http://localhost:${PORT}`);
});

export default app;
