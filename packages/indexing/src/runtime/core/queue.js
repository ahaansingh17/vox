export class BoundedAsyncQueue {
  constructor(maxSize) {
    this.maxSize = maxSize
    this.items = []
    this.closed = false
    this.waitingForItems = []
    this.waitingForSpace = []
  }
  size() {
    return this.items.length
  }
  async push(item) {
    while (!this.closed && this.items.length >= this.maxSize) {
      await new Promise((resolve) => {
        this.waitingForSpace.push(resolve)
      })
    }
    if (this.closed) {
      throw new Error('Queue is closed.')
    }
    if (this.waitingForItems.length) {
      const resolve = this.waitingForItems.shift()
      resolve(item)
      return
    }
    this.items.push(item)
  }
  async pop() {
    if (this.items.length) {
      const nextItem = this.items.shift()
      this.#signalSpace()
      return nextItem
    }
    if (this.closed) {
      return null
    }
    return new Promise((resolve) => {
      this.waitingForItems.push(resolve)
    })
  }
  close() {
    if (this.closed) {
      return
    }
    this.closed = true
    while (this.waitingForItems.length) {
      const resolve = this.waitingForItems.shift()
      resolve(null)
    }
    while (this.waitingForSpace.length) {
      const resolve = this.waitingForSpace.shift()
      resolve()
    }
  }
  #signalSpace() {
    if (!this.waitingForSpace.length) {
      return
    }
    const resolve = this.waitingForSpace.shift()
    resolve()
  }
}
