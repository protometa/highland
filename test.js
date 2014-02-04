var EventEmitter = require('events').EventEmitter,
    streamify = require('stream-array'),
    concat = require('concat-stream'),
    _ = require('./highland');


/**
 * Functional utils
 */

exports['curry'] = function (test) {
    var fn = _.curry(function (a, b, c, d) {
        return a + b + c + d;
    });
    test.equal(fn(1,2,3,4), fn(1,2)(3,4));
    test.equal(fn(1,2,3,4), fn(1)(2)(3)(4));
    var fn2 = function (a, b, c, d) {
        return a + b + c + d;
    };
    test.equal(_.curry(fn2)(1,2,3,4), _.curry(fn2,1,2,3,4));
    test.equal(_.curry(fn2)(1,2,3,4), _.curry(fn2,1,2)(3,4));
    test.done();
};

exports['ncurry'] = function (test) {
    var fn = _.ncurry(3, function (a, b, c, d) {
        return a + b + c + (d || 0);
    });
    test.equal(fn(1,2,3,4), 6);
    test.equal(fn(1,2,3,4), fn(1,2)(3));
    test.equal(fn(1,2,3,4), fn(1)(2)(3));
    var fn2 = function () {
        var args = Array.prototype.slice(arguments);
        return args.reduce(function (a, b) { return a + b; }, 0);
    };
    test.equal(_.ncurry(3,fn2)(1,2,3,4), _.ncurry(3,fn2,1,2,3,4));
    test.equal(_.ncurry(3,fn2)(1,2,3,4), _.ncurry(3,fn2,1,2)(3,4));
    test.done();
};

exports['compose'] = function (test) {
    function append(x) {
        return function (str) {
            return str + x;
        };
    }
    var fn1 = append(':one');
    var fn2 = append(':two');
    var fn = _.compose(fn2, fn1);
    test.equal(fn('zero'), 'zero:one:two');
    fn = _.compose(fn1, fn2, fn1);
    test.equal(fn('zero'), 'zero:one:two:one');
    test.done();
};

exports['partial'] = function (test) {
    var addAll = function () {
        var args = Array.prototype.slice.call(arguments);
        return args.reduce(function (a, b) { return a + b; }, 0);
    };
    var f = _.partial(addAll, 1, 2);
    test.equal(f(3, 4), 10);
    test.done();
};

exports['flip'] = function (test) {
    var subtract = function (a, b) {
        return a - b;
    };
    test.equal(subtract(4,2), 2);
    test.equal(_.flip(subtract)(4,2), -2);
    test.equal(_.flip(subtract, 4)(2), -2);
    test.equal(_.flip(subtract, 4, 2), -2);
    test.done();
};

exports['seq'] = function (test) {
    function append(x) {
        return function (str) {
            return str + x;
        };
    }
    var fn1 = append(':one');
    var fn2 = append(':two');
    var fn = _.seq(fn1, fn2);
    test.equal(fn('zero'), 'zero:one:two');
    // more than two args
    test.equal(_.seq(fn1, fn2, fn1)('zero'), 'zero:one:two:one');
    test.done();
}

/***** Streams *****/

exports['if no consumers, buffer data'] = function (test) {
    var s = _();
    test.equal(s.paused, true);
    s.write(1);
    s.write(2);
    s.toArray(function (xs) {
        test.same(xs, [1,2,3]);
        test.done();
    });
    s.write(3);
    s.write(_.nil);
};

exports['if consumer paused, buffer data'] = function (test) {
    var map_calls = [];
    function doubled(x) {
        map_calls.push(x);
        return x * 2;
    }
    var s = _();
    var s2 = s.map(doubled);
    test.equal(s.paused, true);
    test.equal(s2.paused, true);
    s.write(1);
    s.write(2);
    test.same(map_calls, []);
    s2.toArray(function (xs) {
        test.same(xs, [2, 4, 6]);
        test.same(map_calls, [1, 2, 3]);
        test.done();
    });
    s.write(3);
    s.write(_.nil);
};

exports['write when paused adds to incoming buffer'] = function (test) {
    var s = _();
    test.ok(s.paused);
    test.same(s._incoming, []);
    test.strictEqual(s.write(1), false);
    test.same(s._incoming, [1]);
    test.strictEqual(s.write(2), false);
    test.same(s._incoming, [1,2]);
    test.done();
};

exports['write when not paused sends to consumer'] = function (test) {
    var vals = [];
    var s1 = _();
    var s2 = s1.consume(function (err, x, push, next) {
        vals.push(x);
        next();
    });
    test.ok(s1.paused);
    test.ok(s2.paused);
    test.same(s1._incoming, []);
    test.same(s2._incoming, []);
    s2.resume();
    test.ok(!s1.paused);
    test.ok(!s2.paused);
    test.strictEqual(s1.write(1), true);
    test.strictEqual(s1.write(2), true);
    test.same(s1._incoming, []);
    test.same(s2._incoming, []);
    test.same(vals, [1,2]);
    test.done();
};

exports['buffered incoming data released on resume'] = function (test) {
    var vals = [];
    var s1 = _();
    var s2 = s1.consume(function (err, x, push, next) {
        vals.push(x);
        next();
    });
    test.strictEqual(s1.write(1), false);
    test.same(s1._incoming, [1]);
    test.same(s2._incoming, []);
    s2.resume();
    test.same(vals, [1]);
    test.same(s1._incoming, []);
    test.same(s2._incoming, []);
    test.strictEqual(s1.write(2), true);
    test.same(vals, [1,2]);
    test.done();
};

exports['restart buffering incoming data on pause'] = function (test) {
    var vals = [];
    var s1 = _();
    var s2 = s1.consume(function (err, x, push, next) {
        vals.push(x);
        next();
    });
    s2.resume();
    test.strictEqual(s1.write(1), true);
    test.strictEqual(s1.write(2), true);
    test.same(s1._incoming, []);
    test.same(s2._incoming, []);
    test.same(vals, [1,2]);
    s2.pause();
    test.strictEqual(s1.write(3), false);
    test.strictEqual(s1.write(4), false);
    test.same(s1._incoming, [3,4]);
    test.same(s2._incoming, []);
    test.same(vals, [1,2]);
    s2.resume();
    test.same(s1._incoming, []);
    test.same(s2._incoming, []);
    test.same(vals, [1,2,3,4]);
    test.done();
};

/*
exports['each'] = function (test) {
    var calls = [];
    _.each(function (x) {
        calls.push(x);
    }, [1,2,3]);
    test.same(calls, [1,2,3]);
    // partial application
    _.each(function (x) {
        calls.push(x);
    })([1,2,3]);
    test.same(calls, [1,2,3,1,2,3]);
    test.done();
};
*/

exports['each - ArrayStream'] = function (test) {
    var calls = [];
    _([1,2,3]).each(function (x) {
        calls.push(x);
    });
    test.same(calls, [1,2,3]);
    test.done();
};

exports['each - GeneratorStream'] = function (test) {
    var s = _(function (push, next) {
        push(null, 1);
        push(null, 2);
        push(null, 3);
        push(null, _.nil);
    });
    var calls = [];
    s.each(function (x) {
        calls.push(x);
    });
    test.same(calls, [1,2,3]);
    test.done();
};

exports['each - throw error if consumed'] = function (test) {
    var e = new Error('broken');
    var s = _(function (push, next) {
        push(null, 1);
        push(e);
        push(null, 2);
        push(null, _.nil);
    });
    test.throws(function () {
        s.each(function (x) {
            // do nothing
        });
    });
    test.done();
};

exports['calls generator on read'] = function (test) {
    var gen_calls = 0;
    var s = _(function (push, next) {
        gen_calls++;
        push(null, 1);
        push(null, _.nil);
    });
    test.equal(gen_calls, 0);
    s.take(1).toArray(function (xs) {
        test.equal(gen_calls, 1);
        test.same(xs, [1]);
        s.take(1).toArray(function (ys) {
            test.equal(gen_calls, 1);
            test.same(ys, []);
            test.done();
        });
    });
};

exports['generator consumers are sent values eagerly until pause'] = function (test) {
    var s = _(function (push, next) {
        push(null, 1);
        push(null, 2);
        push(null, 3);
        push(null, _.nil);
    });
    var calls = [];
    var consumer = s.consume(function (err, x, push, next) {
        calls.push(x);
        if (x !== 2) {
            next();
        }
    });
    consumer.resume();
    test.same(JSON.stringify(calls), JSON.stringify([1,2]));
    consumer.resume();
    test.same(calls, [1,2,3,_.nil]);
    test.done();
};

exports['check generator loops on next call without push'] = function (test) {
    var count = 0;
    var s = _(function (push, next) {
        count++;
        if (count < 5) {
            next();
        }
        else {
            push(null, count);
            push(null, _.nil);
        }
    });
    s.toArray(function (xs) {
        test.equal(count, 5);
        test.same(xs, [5]);
        test.done();
    });
};

exports['calls generator multiple times if paused by next'] = function (test) {
    var gen_calls = 0;
    var vals = [1, 2];
    var s = _(function (push, next) {
        gen_calls++;
        if (vals.length) {
            push(null, vals.shift());
            next();
        }
        else {
            push(null, _.nil);
        }
    });
    test.equal(gen_calls, 0);
    s.take(1).toArray(function (xs) {
        test.equal(gen_calls, 1);
        test.same(xs, [1]);
        s.take(1).toArray(function (xs) {
            test.equal(gen_calls, 2);
            test.same(xs, [2]);
            s.take(1).toArray(function (xs) {
                test.equal(gen_calls, 3);
                test.same(xs, []);
                test.done();
            });
        });
    });
};

exports['adding multiple consumers should error'] = function (test) {
    var s = _([1,2,3,4]);
    s.consume(function () {});
    test.throws(function () {
        s.consume(function () {});
    });
    test.done();
};

exports['switch to alternate stream using next'] = function (test) {
    var s2_gen_calls = 0;
    var s2 = _(function (push, next) {
        s2_gen_calls++;
        push(null, 2);
        push(null, _.nil);
    });
    s2.id = 's2';
    var s1_gen_calls = 0;
    var s1 = _(function (push, next) {
        s1_gen_calls++;
        push(null, 1);
        next(s2);
    });
    s1.id = 's1';
    test.equal(s1_gen_calls, 0);
    test.equal(s2_gen_calls, 0);
    s1.take(1).toArray(function (xs) {
        test.equal(s1_gen_calls, 1);
        test.equal(s2_gen_calls, 0);
        test.same(xs, [1]);
        s1.take(1).toArray(function (xs) {
            test.equal(s1_gen_calls, 1);
            test.equal(s2_gen_calls, 1);
            test.same(xs, [2]);
            s1.take(1).toArray(function (xs) {
                test.equal(s1_gen_calls, 1);
                test.equal(s2_gen_calls, 1);
                test.same(xs, []);
                test.done();
            });
        });
    });
};

exports['switch to alternate stream using next (async)'] = function (test) {
    var s2_gen_calls = 0;
    var s2 = _(function (push, next) {
        s2_gen_calls++;
        setTimeout(function () {
            push(null, 2);
            push(null, _.nil);
        }, 10);
    });
    s2.id = 's2';
    var s1_gen_calls = 0;
    var s1 = _(function (push, next) {
        s1_gen_calls++;
        setTimeout(function () {
            push(null, 1);
            next(s2);
        }, 10);
    });
    s1.id = 's1';
    test.equal(s1_gen_calls, 0);
    test.equal(s2_gen_calls, 0);
    s1.take(1).toArray(function (xs) {
        test.equal(s1_gen_calls, 1);
        test.equal(s2_gen_calls, 0);
        test.same(xs, [1]);
        s1.take(1).toArray(function (xs) {
            test.equal(s1_gen_calls, 1);
            test.equal(s2_gen_calls, 1);
            test.same(xs, [2]);
            s1.take(1).toArray(function (xs) {
                test.equal(s1_gen_calls, 1);
                test.equal(s2_gen_calls, 1);
                test.same(xs, []);
                test.done();
            });
        });
    });
};

exports['lazily evalute stream'] = function (test) {
    var map_calls = [];
    function doubled(x) {
        map_calls.push(x);
        return x * 2;
    }
    var s = _([1, 2, 3, 4]);
    s.id = 's';
    s.map(doubled).take(2).toArray(function (xs) {
        test.same(xs, [2, 4]);
    });
    test.same(JSON.stringify(map_calls), JSON.stringify([1, 2]));
    test.done();
};


exports['pipe node stream to highland stream'] = function (test) {
    var xs = [];
    var src = streamify([1,2,3,4]);
    var s1 = _();
    var s2 = s1.consume(function (err, x, push, next) {
        xs.push(x);
        next();
    });
    src.pipe(s1);
    setTimeout(function () {
        test.same(s1._incoming, [1]);
        test.same(s2._incoming, []);
        test.same(xs, []);
        s2.resume();
        setTimeout(function () {
            test.same(s1._incoming, []);
            test.same(s2._incoming, []);
            test.same(xs, [1,2,3,4,_.nil]);
            test.done();
        }, 100);
    }, 100);
};

exports['pipe highland stream to node stream'] = function (test) {
    var src = _(['a','b','c']);
    var dest = concat(function (data) {
        test.same(data, 'abc');
        test.done();
    });
    src.pipe(dest);
};

exports['pipe to node stream with backpressure'] = function (test) {
    var src = _([1,2,3,4]);
    var xs = [];
    var dest = new EventEmitter();
    dest.writable = true;
    dest.write = function (x) {
        xs.push(x);
        if (xs.length === 2) {
            setImmediate(function () {
                test.same(xs, [1,2]);
                test.ok(src.paused);
                dest.emit('drain');
            });
            return false;
        }
    };
    dest.end = function () {
        test.same(xs, [1,2,3,4]);
        test.done();
    };
    src.pipe(dest);
};

exports['wrap node stream and pipe'] = function (test) {
    function doubled(x) {
        return x * 2;
    }
    var xs = [];
    var readable = streamify([1,2,3,4]);
    var ys = _(readable).map(doubled);

    var dest = new EventEmitter();
    dest.writable = true;
    dest.write = function (x) {
        xs.push(x);
        if (xs.length === 2) {
            setImmediate(function () {
                test.same(xs, [2,4]);
                test.ok(ys.source.paused);
                test.equal(readable._readableState.readingMore, false);
                dest.emit('drain');
            });
            return false;
        }
    };
    dest.end = function () {
        test.same(xs, [2,4,6,8]);
        test.done();
    };
    // make sure nothing starts until we pipe
    test.same(xs, []);
    test.same(ys._incoming, []);
    test.same(ys.source._incoming, []);
    ys.pipe(dest);
};

exports['attach data event handler'] = function (test) {
    var s = _([1,2,3,4]);
    var xs = [];
    s.on('data', function (x) {
        xs.push(x);
    });
    s.on('end', function () {
        test.same(xs, [1,2,3,4]);
        test.done();
    });
};

exports['multiple pull calls on async generator'] = function (test) {
    var calls = 0;
    function countdown(n) {
        var s = _(function (push, next) {
            calls++;
            if (n === 0) {
                push(null, _.nil);
            }
            else {
                setTimeout(function () {
                    push(null, n);
                    next(countdown(n - 1));
                }, 10);
            }
        });
        s.id = 'countdown:' + n;
        return s;
    }
    var s = countdown(3);
    var s2 = _(function (push, next) {
        s.pull(function (err, x) {
            if (err || x !== _.nil) {
                push(err, x);
                next();
            }
            else {
                push(null, _.nil);
            }
        });
    });
    s2.id = 's2';
    s2.toArray(function (xs) {
        test.same(xs, [3,2,1]);
        test.same(calls, 4);
        test.done();
    });
};

/*
exports['sequence'] = function (test) {
    _.sequence([[1,2], [3], [[4],5]]).toArray(function (xs) {
        test.same(xs, [1,2,3,[4],5]);
    });
    test.done();
};
*/

exports['sequence - ArrayStream'] = function (test) {
    _([[1,2], [3], [[4],5]]).sequence().toArray(function (xs) {
        test.same(xs, [1,2,3,[4],5]);
    });
    test.done();
};

exports['sequence - GeneratorStream'] = function (test) {
    var calls = [];
    function countdown(name, n) {
        var s = _(function (push, next) {
            calls.push(name);
            if (n === 0) {
                push(null, _.nil);
            }
            else {
                setTimeout(function () {
                    push(null, n);
                    next(countdown(name, n - 1));
                }, 10);
            }
        });
        s.id = 'countdown:' + name + ':' + n;
        return s;
    }
    var s1 = countdown('one', 3);
    var s2 = countdown('two', 3);
    var s3 = countdown('three', 3);
    _([s1, s2, s3]).sequence().take(8).toArray(function (xs) {
        test.same(xs, [3,2,1,3,2,1,3,2]);
        test.same(calls, [
            'one', 'one', 'one', 'one',
            'two', 'two', 'two', 'two',
            'three', 'three' // last call missed off due to take(8)
        ]);
        test.done();
    });
};

exports['sequence - nested GeneratorStreams'] = function (test) {
    var s2 = _(function (push, next) {
        push(null, 2);
        push(null, _.nil);
    });
    var s1 = _(function (push, next) {
        push(null, 1);
        push(null, s2);
        push(null, _.nil);
    });
    _([s1]).sequence().toArray(function (xs) {
        test.same(xs, [1, s2]);
    });
    test.done();
};

/*
exports['sequence - series alias'] = function (test) {
    test.equal(_.sequence, _.series);
    var s1 = _([1,2,3]);
    var s2 = _(function (push, next) {});
    test.equal(s1.sequence, s1.series);
    test.equal(s2.sequence, s2.series);
    test.done();
};
*/

exports['fork'] = function (test) {
    var s = _([1,2,3,4]);
    s.id = 's';
    var s2 = s.map(function (x) {
        return x * 2;
    });
    s2.id = 's2';
    var s3 = s.fork().map(function (x) {
        return x * 3;
    });
    s3.id = 's3';
    var s2_data = [];
    var s3_data = [];
    s2.take(1).each(function (x) {
        s2_data.push(x);
    });
    // don't start until both consumers resume
    test.same(s2_data, []);
    s3.take(2).each(function (x) {
        s3_data.push(x);
    });
    test.same(s2_data, [2]);
    test.same(s3_data, [3]);
    s2.take(1).each(function (x) {
        s2_data.push(x);
    });
    test.same(s2_data, [2,4]);
    test.same(s3_data, [3,6]);
    s3.take(2).each(function (x) {
        s3_data.push(x);
    });
    test.same(s2_data, [2,4]);
    test.same(s3_data, [3,6]);
    s2.take(2).each(function (x) {
        s2_data.push(x);
    });
    test.same(s2_data, [2,4,6,8]);
    test.same(s3_data, [3,6,9,12]);
    test.done();
};

exports['observe'] = function (test) {
    var s = _([1,2,3,4]);
    s.id = 's';
    var s2 = s.map(function (x) {
        return x * 2;
    });
    s2.id = 's2';
    var s3 = s.observe().map(function (x) {
        return x * 3;
    });
    s3.id = 's3';
    var s2_data = [];
    var s3_data = [];
    s2.take(1).each(function (x) {
        s2_data.push(x);
    });
    test.same(s2_data, [2]);
    test.same(s3_data, []);
    test.same(s3.source._incoming, [1]);
    s3.take(2).each(function (x) {
        s3_data.push(x);
    });
    test.same(s2_data, [2]);
    test.same(s3_data, [3]);
    s2.take(1).each(function (x) {
        s2_data.push(x);
    });
    test.same(s2_data, [2,4]);
    test.same(s3_data, [3,6]);
    s3.take(2).each(function (x) {
        s3_data.push(x);
    });
    test.same(s2_data, [2,4]);
    test.same(s3_data, [3,6]);
    s2.take(2).each(function (x) {
        s2_data.push(x);
    });
    test.same(s2_data, [2,4,6,8]);
    test.same(s3_data, [3,6,9,12]);
    test.done();
};

// TODO: test redirect after fork, forked streams should transfer over
// TODO: test redirect after observe, observed streams should transfer over

exports['flatten'] = function (test) {
    _.flatten([1, [2, [3, 4], 5], [6]]).toArray(function (xs) {
        test.same(xs, [1,2,3,4,5,6]);
    });
    test.done();
};

exports['flatten - ArrayStream'] = function (test) {
    _([1, [2, [3, 4], 5], [6]]).flatten().toArray(function (xs) {
        test.same(xs, [1,2,3,4,5,6]);
    });
    test.done();
};

exports['flatten - GeneratorStream'] = function (test) {
    var s3 = _(function (push, next) {
        setTimeout(function () {
            push(null, 3);
            push(null, 4);
            push(null, _.nil);
        }, 200);
    });
    var s2 = _(function (push, next) {
        setTimeout(function () {
            push(null, 2);
            push(null, s3);
            push(null, 5);
            push(null, _.nil);
        }, 50);
    });
    var s1 = _(function (push, next) {
        push(null, 1);
        push(null, s2);
        push(null, [6]);
        push(null, _.nil);
    });
    s1.flatten().toArray(function (xs) {
        test.same(xs, [1,2,3,4,5,6]);
        test.done();
    });
};

exports['flatten - nested GeneratorStreams'] = function (test) {
    var s2 = _(function (push, next) {
        push(null, 2);
        push(null, _.nil);
    });
    var s1 = _(function (push, next) {
        push(null, 1);
        push(null, s2);
        push(null, _.nil);
    });
    s1.flatten().toArray(function (xs) {
        test.same(xs, [1, 2]);
        test.done();
    });
};
