import * as net from 'net'

/**
 * async wrapper for `net.Socket`.
 * Use soInit to get a `TCPConn` from `net.Socket`,
 */
interface TCPConn {
	socket: net.Socket
	err: null | Error
	ended: boolean
	reader: null | {
		resolve: (data: Buffer) => void
		reject: (err: Error) => void
	}
}
/**
 * Initialize a `TCPConn` from `net.Socket`
 */
export function soInit(socket: net.Socket) {
	const conn: TCPConn = {
		socket,
		err: null,
		ended: false,
		reader: null
	}
	conn.socket.on('data', (data: Buffer) => {
		console.assert(conn.reader)
		conn.socket.pause()

		conn.reader!.resolve(data)
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

/**
 * Read from a `TCPConn`.
 * Each read corresponds to a single 'data' event
 * Returns an empty string on end of data
 */
export function soRead(conn: TCPConn): Promise<Buffer> {
	console.assert(!conn.reader)
	return new Promise((resolve, reject) => {
		if (conn.err) {
			reject(conn.err)
			return
		}
		if (conn.ended) {
			resolve(Buffer.from(''))
			return
		}
		conn.reader = { resolve, reject }
		conn.socket.resume()
	})
}

/**
 * Write to a `TCPConn`.
 * writes `data` to the socket of course
 */
export function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
	console.assert(data.length > 0)
	return new Promise((resolve, reject) => {
		if (conn.err) {
			reject(conn.err)
			return
		}
		conn.socket.write(data, (err?: Error | null) => {
			if (err) reject(err)
			else resolve()
		})
	})
}
