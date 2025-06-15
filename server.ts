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

interface DynBuf {
	data: Buffer
	length: number
}
function bufPush(buf: DynBuf, data: Buffer) {
	const newLen = buf.length + data.length
	if (newLen > buf.data.length) {
		let cap = Math.max(buf.data.length, 32);
		while (cap < newLen) {
			cap *= 2
		}
		const grown = Buffer.alloc(cap)
		buf.data.copy(grown, 0, 0)
		buf.data = grown
	}
	data.copy(buf.data, buf.length, 0)
	buf.length = newLen
}

function bufPop(buf: DynBuf, len: number) {
	buf.data.copyWithin(0, len, buf.length)
	buf.length -= len
}

//promise based wrapper  for socket api
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

function soRead(conn: TCPConn): Promise<Buffer> {
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

function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
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

async function serveClient(socket: net.Socket) {
	const conn = soInit(socket)
	const stream: DynBuf = { length: 0, data: Buffer.alloc(0) }
	while (true) {
		const msg = cutMessage(stream)
		if (!msg) {
			const data = await soRead(conn)
			if (data.length === 0) {
				console.log('FIN!')
				break
			}
			bufPush(stream, data)
			continue
		}
		//type Muthiti to terminate connection
		if (msg.toString().trim() === 'Muthiti!') {
			await soWrite(conn, Buffer.from('Muthiti uu twonane ivinda yingi!\n'));
			socket.destroy();
			return;
		} else {
			const reply = Buffer.concat([Buffer.from('Echo: '), msg]);
			await soWrite(conn, reply);
		}
	}
}
function cutMessage(buf: DynBuf): null | Buffer {
	const idx = buf.data.subarray(0, buf.length).indexOf('\n')
	if (idx < 1) return null //no new line so no complete message yet

	//get message and pop it off the buffer
	const msg = Buffer.from(buf.data.subarray(0, idx + 1))
	bufPop(buf, idx + 1)
	return msg
}
