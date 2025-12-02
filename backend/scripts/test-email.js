import dotenv from "dotenv";
dotenv.config();
import { sendEmail } from "../lib/email.js";

(async () => {
  try {
    const res = await sendEmail({
      to: "your.other.email@example.com",
      subject: "Test mail from noteapp",
      text: "Hello — this is a test.",
      html: "<p>Hello — this is a test.</p>"
    });
    console.log("sent:", res.messageId);
  } catch (e) {
    console.error("send failed:", e);
  }
})();
