import http from "node:http";
import createApp from "./src/app.js";
import connectDB from "./src/shared/config/db.config.js";
import env from "./src/shared/config/env.config.js";
import logger from "./src/shared/config/logger.config.js";
import socketService from "./src/shared/services/socket.service.js";
import { queueService } from "./src/shared/services/queue.service.js";

async function startServer() {
	const app = createApp();
	const server = http.createServer(app);

	// initialize Socket.IO server for printer agent communication
	socketService.init(server);

	await connectDB();

	// Run initial cleanup of abandoned temporary files and schedule periodic cleanup
	queueService.processCleanupJob();
	setInterval(() => {
		queueService.processCleanupJob();
	}, 5 * 60 * 1000);

	server.listen(env.PORT || 5000, () => {
		logger.info(`Server is running on port ${env.PORT || 5000}`);
	});
}

startServer();
