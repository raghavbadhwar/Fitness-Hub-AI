const appPromise = import("../artifacts/api-server/dist/vercel.mjs").then(
  (module) => module.default,
);

module.exports = async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
};
