const cors = require('cors');
const express = require('express');
const app = express();
const mysql = require('mysql2');
const redis = require('redis');
require('dotenv').config();
const winston = require('winston');
const loggerApp = winston.createLogger({
	level: 'info',
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: './logs/app.log' }),
	],
});

const loggerHttp = new winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: './logs/http.log' }),
	],
});

// Set up CORS
const corsOptions = {
	origin: '*',
};
app.use(cors(corsOptions));

// Set json for getting data from request body
app.use(express.json());

app.use((req, res, next) => {
	loggerHttp.info('HTTP request', req.url);
	next();
});

// Redis setup
let redisClient;
(async () => {
	redisClient = redis.createClient({
		url: process.env.REDIS_URL,
	});

	redisClient.on('error', (error) => {
		console.error(`Error : ${error}`);
		loggerApp.error(`Error : ${error}`);
	});

	redisClient.on('connect', () => {
		console.log('Redis connected');
		loggerApp.info('Redis connected');
	});

	await redisClient.connect();
})();

loggerApp.info({
	DB_HOST: process.env.DB_HOST,
	DB_PORT: process.env.DB_PORT,
	DB_USER: process.env.DB_USER,
	DB_PASS: process.env.DB_PASS,
	DB_NAME: process.env.DB_NAME,
});

// MySQL setup
const DB = mysql.createConnection({
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
});

// Connect to MySQL
DB.connect((err) => {
	if (err) {
		loggerApp.error(err);
		throw err;
	}
	console.log('MySQL connected');
	loggerApp.info('MySQL connected');
});

// Routes
app.get('/', (req, res) => {
	res.send('<h1 style="text-align: center;">Welcome to the Todo List API!</h1>');
	loggerApp.info('Todo List API accessed', req);
});

// Fetching data from Database or Redis
app.get('/todos', async (req, res) => {
	try {
		// Check if cached data exists in Redis or not. If yes, return cached data
		const cachedData = await redisClient.get('todos');
		if (cachedData) {
			return res.send({
				success: true,
				message: 'Todos retrieved from cache successfully!',
				data: JSON.parse(cachedData),
			});
		}

		// If cached data doesn't exist, fetch data from database and cache it
		const results = await new Promise((resolve, reject) => {
			DB.query('SELECT * FROM todos', (err, results) => {
				if (err) reject(err);
				resolve(results);
			});
		});

		// If no data found in database, return error message
		if (!results.length) {
			return res.send({
				success: false,
				message: 'No todos found!',
				data: results,
			});
		}

		// Cache data in Redis for 1 hour (3600 seconds)
		redisClient.setEx('todos', 3600, JSON.stringify(results));
		// Return response
		return res.send({
			success: true,
			message: 'Todos retrieved from database successfully!',
			data: results,
		});
	} catch (error) {
		// Catch any error
		loggerApp.error(error);
		throw error;
	}
});

// Create new todo/ Add todo
app.post('/todos', (req, res) => {
	// Get data from request body
	const { title, description } = req.body;

	// Insert todo into database
	DB.query(
		'INSERT INTO todos (title, description) VALUES (?, ?)',
		[title, description],
		(err, results) => {
			if (err) throw err; // Throw error if any

			// If no rows affected, then todo not inserted
			if (!results.affectedRows) {
				return res.send({
					success: false,
					message: 'Todo not added!',
					data: results,
				});
			}

			// Delete cached data from Redis
			redisClient.del('todos');

			// Return response
			return res.send({
				success: true,
				message: 'Todo added successfully!',
				data: {
					id: results.insertId,
					title,
					description,
				},
			});
		}
	);
});

// Update todo
app.put('/todos/:id', (req, res) => {
	// Get data from request body
	const { title, description } = req.body;

	// Update todo in database
	DB.query(
		'UPDATE todos SET title = ?, description = ? WHERE id = ?',
		[title, description, req.params.id],
		(err, results) => {
			if (err) throw err; // Throw error if any

			// If no rows affected, then todo not updated
			if (!results.affectedRows) {
				return res.send({
					success: false,
					message: 'Todo not updated!',
					data: results,
				});
			}

			// Delete cached data from Redis
			redisClient.del('todos');

			// Return response
			return res.send({
				success: true,
				message: 'Todo updated successfully!',
				data: {
					id: req.params.id,
					title,
					description,
				},
			});
		}
	);
});

// Delete todo
app.delete('/todos/:id', (req, res) => {
	DB.query('DELETE FROM todos WHERE id = ?', [req.params.id], (err, results) => {
		if (err) throw err; // Throw error if any

		// If no rows affected, then todo not deleted
		if (!results.affectedRows) {
			return res.send({
				success: false,
				message: 'Todo not deleted!',
				data: results,
			});
		}

		// Delete cached data from Redis
		redisClient.del('todos');

		// Return response
		return res.send({
			success: true,
			message: 'Todo deleted successfully!',
		});
	});
});

// Start server
const port = process.env.PORT || 5000;

// Listen on port
app.listen(port, () => {
	console.log(`Running at port - ${port}`);
});
