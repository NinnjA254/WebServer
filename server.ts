import * as net from 'net'

let server = net.createServer({ pauseOnConnect: true })
server.listen({ host: '127.0.0.1', port: 1234 });
async function newConn(socket: net.Socket) {
	console.log('new connection', socket.remoteAddress, socket.remotePort);
	try {
		await serveClient(socket)
	} catch (e) {
		console.error('exception', e)
	} finally {
		socket.destroy()
	}
}
server.on('connection', newConn)

interface TCPConn {
	socket: net.Socket
	err: null | Error
	ended: boolean
	reader: null | {
		resolve: (data: Buffer) => void
		reject: (err: Error) => void
	}
}
function soInit(socket: net.Socket) {
	const conn: TCPConn = {
		socket,
		err: null,
		ended: false,
		reader: null
	}
	conn.socket.on('data', (data: Buffer) => {
		console.assert(conn.reader)
		conn.socket.pause()

		conn.reader.resolve(data)
		conn.reader = null
	})
	conn.socket.on('error', (err: Error) => {
		conn.err = err
		if (conn.reader) {
			conn.reader.reject(err)
			conn.reader = null
		}
	})
	conn.socket.on('end', () => {
		conn.ended = true
		if (conn.reader) {
			conn.reader.resolve(Buffer.from(''))
			conn.reader = null
		}
	})
	return conn
}

function soRead(conn: TCPConn): Promise<Buffer> {
	console.assert(!conn.reader)
	return new Promise((resolve, reject) => {
		if (conn.err) {
			reject(conn.err)
			return
		}
		if (conn.ended) {
			conn.reader.resolve(Buffer.from(''))
			return
		}
		conn.reader = { resolve, reject }
		conn.socket.resume()
	})
}

function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
	console.assert(data.length > 0)
	return new Promise((resolve, reject) => {
		if (conn.err) {
			reject(conn.err)
			return
		}
		conn.socket.write(data, (err?: Error) => {
			if (err) reject(err)
			else resolve()
		})
	})
}

async function serveClient(socket: net.Socket) {
	const conn = soInit(socket)
	while (true) {
		const data = await soRead(conn)
		if (data.length === 0) {
			console.log('connection closed')
			break;
		}
		console.log('data', data)
		await soWrite(conn, Buffer.from('echo: ' + data))
	}
}
