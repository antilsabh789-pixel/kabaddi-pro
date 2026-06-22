import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Allow larger request bodies — avatar uploads send the image as a base64
// data URL in JSON, which is ~33% larger than the raw file. A 2MB image
// becomes ~2.67MB as base64. Default express.json() limit is 100KB which
// was causing all avatar uploads to fail with a silent PayloadTooLargeError.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use("/api", router);

export default app;
