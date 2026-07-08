import nodemailer from "nodemailer";

const requiredEnv = [
  "GMAIL_USERNAME",
  "GMAIL_APP_PASSWORD",
  "EMAIL_TO",
  "EMAIL_SUBJECT",
  "EMAIL_BODY"
];

const missing = requiredEnv.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(`Missing required email environment variables: ${missing.join(", ")}`);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USERNAME,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const result = await transporter.sendMail({
  from: `"Passport Pickup Monitor" <${process.env.GMAIL_USERNAME}>`,
  to: process.env.EMAIL_TO,
  subject: process.env.EMAIL_SUBJECT,
  text: process.env.EMAIL_BODY,
  html: process.env.EMAIL_HTML_BODY || undefined
});

console.log("Email sent through Gmail SMTP.");
console.log(`Message ID: ${result.messageId}`);
console.log(`Accepted: ${result.accepted?.join(", ") || "none"}`);
console.log(`Rejected: ${result.rejected?.join(", ") || "none"}`);
console.log(`SMTP response: ${result.response || "none"}`);

if (result.rejected?.length > 0 || !result.accepted?.length) {
  throw new Error("Gmail SMTP did not accept any recipient.");
}
