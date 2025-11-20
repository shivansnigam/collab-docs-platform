// server.js
import app from "./app.js";
import connectDB from "./config/db.js";

const start = async () => {
  try {
    await connectDB();
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`Server started on ${port}`));
  } catch (err) {
    console.error("Failed to start:", err.message);
    process.exit(1);
  }
};

start();
