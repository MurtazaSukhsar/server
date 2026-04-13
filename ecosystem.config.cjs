module.exports = {
  apps: [
    {
      name: "hub",
      script: "./server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        BACKEND_URL: "http://localhost:5000"
      }
    },
    {
      name: "backend",
      script: "./backend/app.py",
      interpreter: "python",
      env: {
        PORT: 5000
      }
    }
  ]
};
