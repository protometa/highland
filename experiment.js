// stream factory
_ = function (source) {
  return new Stream(makeGenerator(source))
}

// generator factory
function makeGenerator (source) {
  // source may be array or generator function
  if (Array.isArray(source)) {
    let i = 0
    return function (push) {
      if (i >= source.length) return push(null, Stream.end)
      push(null, source[i++])
    }
  } else {
    return source
  }
}

function Stream (generator) {
  this.generator = generator
  this.out = []
  this.outIndex = 0
  this.inIndex = 0
  this.consumers = []
  this.ended = false
}

Stream.empty = {}
Stream.end = ['EOS']
Stream.buffer = 100

Stream.prototype.register = function (stream) {
  this.consumers.push(stream)
}

Stream.prototype.write = function (err, x) {
  if (err) this.out.push(err)
  if (x) this.out.push(x)
}

Stream.prototype.read = function (cb, index) {
  index = index || this.outIndex
  existing = this.out[index - this.outIndex]
  if (existing) {
    if (existing.constructor === Error) return cb(existing)
    cb(null, existing)
  } else {
    this.generator((err, x) => {
      this.write(err, x)
      cb(err, x)
    })
  }
}

Stream.prototype.map = function (f) {
  const self = this
  const downStream = _(function (push) {
    self.read(function (err, x) {
      if (err) return push(err)
      if (x === Stream.end) return push(null, x)
      push(null, f(x))
    }, downStream.inIndex++)
  })
  this.register(downStream)
  return downStream
}

// Stream.prototype.reduce = function (f, init) {
//   const downStream = new Stream(function (write) {

//   })
// }

Stream.prototype.each = function (f) {
  const iterate = (i) => {
    this.read((err, x) => {
      if (x === Stream.end) return
      f(x)
      iterate(++i)
    }, i)
  }
  iterate(0)
}

var a = _([1,2,3])
var b = a.map(x => x * 5)
b.each(x => {
  console.log('each b:', x)
  console.log(a.out)
  console.log(b.out, b.inIndex)
})

b.each(x => {
  console.log('each b:', x)
  console.log(a.out)
  console.log(b.out, b.inIndex)
})

var c = a.map(x => x * 7)
c.each(x => {
  console.log('each c:', x)
  console.log(a.out)
  console.log(c.out, c.inIndex)
})


