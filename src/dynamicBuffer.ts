/**
 * Dynamically growing buffer (amortized)
 */
export type DynBuf = {
	data: Buffer
	length: number
}
/**
 *  Add data at the tailend of the buffer.
 */
export function bufPush(buf: DynBuf, data: Buffer) {
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

/**
 *  Remove `len` bytes from the start of the buffer.
 */
export function bufPop(buf: DynBuf, len: number) { //improve this by deferring the shift after pop?
	buf.data.copyWithin(0, len, buf.length)
	buf.length -= len
}
