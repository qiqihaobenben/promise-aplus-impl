const delay = (f, time = 0) => value => setTimeout(() => f(value), time)
const isFunction = obj => typeof obj === "function"
const toString = Object.prototype.toString
const isObject = obj => toString.call(obj) === "[object Object]"
const isThenable = obj => (isObject(obj) || isFunction(obj)) && "then" in obj

const PENDING = "pending"
const FULFILLED = "fulfilled"
const REJECTED = "rejected"

const notify = (listener, state, value, reason) => {
  let { onFulfilled, onRejected } = listener
  if (state === FULFILLED) return onFulfilled(value)
  if (state === REJECTED) return onRejected(reason)
  throw new Error(`unsupported state in pormise ${state}`)
}

const notifyAll = promise => {
  let { listeners, state, value, reason, isLastest } = promise
  if (state === REJECTED && isLastest) {
    console.error(`Uncaught error in promise ${JSON.stringify(reason)}`)
  }
  while (listeners.length) notify(listeners.shift(), state, value, reason)
}

const macroTasks = []
const microTasks = []
const clearTasks = delay(() => {
  while (macroTasks.length) notifyAll(macroTasks.shift())
  while (microTasks.length) notifyAll(microTasks.shift())
})
const processTask = promise => {
  if (promise.state === PENDING) return
  if (promise.state === REJECTED && !promise.listeners.length) {
    microTasks.push(promise)
  } else {
    macroTasks.push(promise)
  }
  clearTasks()
}

function Promise(f) {
  this.isLastest = true
  this.state = PENDING
  this.listeners = []
  let handleValue = value => {
    if (this.state !== PENDING) return
    if (value === this) {
      return handleReason(new TypeError("Can not fufill promise with itself"))
    }
    if (value instanceof Promise) {
      return value.then(handleValue, handleReason)
    }
    if (isThenable(value)) {
      try {
        let then = value.then
        if (isFunction(then)) {
          return new Promise(then.bind(value)).then(handleValue, handleReason)
        }
      } catch (error) {
        return handleReason(error)
      }
    }
    this.state = FULFILLED
    this.value = value
    processTask(this)
  }
  let handleReason = reason => {
    this.state = REJECTED
    this.reason = reason
    processTask(this)
  }
  let ignore = false
  let resolve = value => {
    if (ignore) return
    ignore = true
    handleValue(value)
  }
  let reject = reason => {
    if (ignore) return
    ignore = true
    handleReason(reason)
  }
  try {
    f(resolve, reject)
  } catch (error) {
    if (!ignore) reject(error)
  }
}

Promise.prototype.then = function(onFulfilled, onRejected) {
  this.isLastest = false
  return new Promise((resolve, reject) => {
    let handleFulfilled = value => {
      if (!isFunction(onFulfilled)) return resolve(value)
      try {
        resolve(onFulfilled(value))
      } catch (error) {
        reject(error)
      }
    }
    let handleRejected = reason => {
      if (!isFunction(onRejected)) return reject(reason)
      try {
        resolve(onRejected(reason))
      } catch (error) {
        reject(error)
      }
    }
    let listener = { onFulfilled: handleFulfilled, onRejected: handleRejected }
    this.listeners.push(listener)
    processTask(this)
  })
}

Promise.prototype.catch = function(onRejected) {
  return this.then(null, onRejected)
}

Promise.resolve = value => new Promise(resolve => resolve(value))
Promise.reject = reason => new Promise((_, reject) => reject(reason))
Promise.all = (promises = []) => {
  return new Promise((resolve, reject) => {
    let values = []
    let onFulfilled = value => {
      values.push(value) === promises.length && resolve(values)
    }
    promises.forEach(promise => promise.then(onFulfilled, reject))
  })
}
Promise.race = (promises = []) => {
  return new Promise((resolve, reject) =>
    promises.forEach(promise => promise.then(resolve, reject))
  )
}

module.exports = Promise