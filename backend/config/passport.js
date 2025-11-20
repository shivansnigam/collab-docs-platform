// config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";

export default function setupPassport() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        let user = await User.findOne({ provider: "google", providerId: profile.id });
        if (!user && email) user = await User.findOne({ email });
        if (!user) {
          user = await User.create({ name: profile.displayName || email, email, provider: "google", providerId: profile.id });
        } else {
          user.provider = "google"; user.providerId = profile.id; await user.save();
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }));
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
      scope: ["user:email"]
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        let user = await User.findOne({ provider: "github", providerId: profile.id });
        if (!user && email) user = await User.findOne({ email });
        if (!user) {
          user = await User.create({ name: profile.displayName || email, email, provider: "github", providerId: profile.id });
        } else {
          user.provider = "github"; user.providerId = profile.id; await user.save();
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }));
  }
}
