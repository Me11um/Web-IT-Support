const mysql = require('mysql2')
const cookieParser = require('cookie-parser')
const express = require('express')
const axios = require('axios')

const app = express()

const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
})

users = []
connections = []

io.sockets.on('connection', function(socket) {
    console.log("Connection successful")
    connections.push(socket)

    socket.on('disconnect', function(data) {
        connections.splice(connections.indexOf(socket), 1)
        console.log("Disconnection successful")
    })

    socket.on('send mess', function(data) {

        const now = new Date()

        const year = now.getFullYear()
        const month = ("0" + (now.getMonth() + 1)).slice(-2)
        const day = ("0" + now.getDate()).slice(-2)

        const hour = ("0" + now.getHours()).slice(-2)
        const minute = ("0" + now.getMinutes()).slice(-2)
        const second = ("0" + now.getSeconds()).slice(-2)

        // YYYY-MM-DD hh:mm:ss
        const formatted = `${day}-${month}-${year} ${hour}:${minute}:${second}`
    
        db.query('INSERT INTO messages(request_id, message_admin, message_text, message_user, message_date) VALUES (?,?,?,?,?)', 
        [data.req_id, data.isadmin, data.message_text, data.user_id, formatted], (error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
        })
        io.sockets.emit('add mess', { req_id: data.req_id, isadmin: data.isadmin, message_text: data.message_text, user_name: data.user_name, profile_picture: data.profile_picture, message_date: formatted })
    })

    socket.on('take req', function(data) {

        const now = new Date()

        const year = now.getFullYear()
        const month = ("0" + (now.getMonth() + 1)).slice(-2)
        const day = ("0" + now.getDate()).slice(-2)

        const hour = ("0" + now.getHours()).slice(-2)
        const minute = ("0" + now.getMinutes()).slice(-2)
        const second = ("0" + now.getSeconds()).slice(-2)

        // YYYY-MM-DD hh:mm:ss
        const formatted = `${day}-${month}-${year} ${hour}:${minute}:${second}`
        
        var message = ""
        var set_status = 0
        var username = ""
        if (parseInt(data.status) == 0) {
            message = "Ваша заявка была принята специалистом №" + String(data.user_id) + ". Специалист в данный момент ознакамливается с вашей проблемой и работает над решением. Пожалуйста, ожидайте ответ."
            set_status = data.user_id
        }

        if (parseInt(data.status) == -1) {
            message = "Ваша заявка была возобновлена специалистом №" + String(data.user_id) + ". Пожалуйста, ожидайте ответ."
            set_status = data.user_id
        }

        if (parseInt(data.status) > 0) {
            message = "Ваша заявка была завершена специалистом №" + String(data.user_id) + "."
            if (data.isadmin == 0) message = "Пользователь завершил заявку"
            set_status = -1
        }

        db.query('UPDATE requests SET status = ? WHERE id = ?', 
        [set_status, data.req_id], (error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
        })
        
        db.query('INSERT INTO messages(request_id, message_admin, message_text, message_user, message_date) VALUES (?,?,?,?,?)', 
        [data.req_id, 1, message, 0, formatted], (error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
        })
        io.sockets.emit('add mess', { req_id: data.req_id, isadmin: 1, message_text: message, user_name: "СИСТЕМА", profile_picture: "/img/system.jpg", message_date: formatted })
        db.query('SELECT name FROM users WHERE id = ?', [data.user_id] ,(error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
            username = results[0].name
            io.sockets.emit('take request', { req_id: data.req_id, status: set_status, user: username })
        })
    })

})

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "support",
    password: "123456"
})

db.connect( err => {
    if (err) {
        console.log(err)
        return err
    } else {
        console.log('Database ----- OK')
    }
})

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false}))
app.use(cookieParser())
app.use(cors({ origin: "*" }));

app.get('/', (req, res) => {
    res.render('index', { error_message: "" })
}) 

app.post('/login', (req, res) => {
    console.log(req.body)

    const { login, password } = req.body

    db.query('SELECT * FROM users WHERE login = ? and password = ?', [login, password], (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        if (results.length > 0) {
            res.cookie('logged_user', results[0].id)
            if (results[0].isadmin == 1) res.redirect("/admin"); else res.redirect("/user");
        } else {
            res.render('index', { error_message: "Пользователь не найден" })
        } 
    })

})

app.post('/logout', (req, res) => {
    console.log(req.body)

    const { login, password } = req.body

    res.clearCookie('logged_user');
    res.redirect("/");
})

app.get('/user', (req, res) => {

    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    var res1;
    var res2;

    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res1 = results
    })
    db.query('SELECT * FROM users', (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res2 = results
    })
    db.query('SELECT requests.id, status, text, date, users.name as user, user as user_id FROM requests INNER JOIN users ON requests.user = users.id WHERE requests.user = ? ORDER BY requests.id DESC', [logged_user] , (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res.render('user_requests', { requests: results, user: res1[0], users: res2, current_user: logged_user })
    })

}) 

app.get('/user/new-request', (req, res) => {

    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
            res.render('user_new_request', { user: results[0] })
    })

})

app.post('/user/new-request', (req, res) => {
    
    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }
    
    console.log(req.body)

    const { request_text } = req.body

    const now = new Date()

    const year = now.getFullYear()
    const month = ("0" + (now.getMonth() + 1)).slice(-2)
    const day = ("0" + now.getDate()).slice(-2)

    const hour = ("0" + now.getHours()).slice(-2)
    const minute = ("0" + now.getMinutes()).slice(-2)
    const second = ("0" + now.getSeconds()).slice(-2)

    // YYYY-MM-DD hh:mm:ss
    const formatted = `${day}-${month}-${year} ${hour}:${minute}:${second}`

    var res1

    db.query('INSERT INTO requests(status, text, date, user) VALUES (?,?,?,?)', [0, request_text, formatted, logged_user], (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
    })

    db.query('SELECT * FROM requests WHERE date = ? and user = ?', [formatted, logged_user], (error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
        res1 = results
        db.query('INSERT INTO messages(request_id, message_admin, message_text, message_user, message_date) VALUES (?,?,?,?,?)', [res1[0].id, 0, request_text, logged_user, formatted], 
        (error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
            res.redirect("/user/requests/" + res1[0].id);
        })
    })

})

app.get('/user/new-request', (req, res) => {

    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
            res.render('user_new_request', { user: results[0] })
    })

})

app.post('/admin/settings/save', (req, res) => {
    
    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }
    
    console.log(req.body)

    const { name, password } = req.body

    var res1

    db.query('UPDATE users SET name = ?, password = ? WHERE id = ?', [name, password, logged_user], 
     (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res.redirect("/admin/settings");
    })

})

app.post('/user/settings/save', (req, res) => {
    
    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }
    
    console.log(req.body)

    const { name, password } = req.body

    var res1

    db.query('UPDATE users SET name = ?, password = ? WHERE id = ?', [name, password, logged_user], 
     (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res.redirect("/user/settings");
    })

})

app.post('/admin/settings/save_picture', (req, res) => {
    
    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }
    
    console.log(req.body)

    const { link } = req.body

    pic_error = ""

    if (link.match(/\.(jpeg|jpg|png)$/) == null) {
        pic_error = "Ошибка: недопустимый формат изображения"
    }

    if (pic_error == "") {
        db.query('UPDATE users SET profile_picture = ? WHERE id = ?', [link, logged_user], 
        (error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
                res.redirect("/admin/settings");
        })
    } else {
        db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
                res.render('admin_settings', { user: results[0], picture_error: pic_error })
        })
    }
})

app.post('/user/settings/save_picture', (req, res) => {
    
    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }
    
    console.log(req.body)

    const { link } = req.body

    pic_error = ""

    if (link.match(/\.(jpeg|jpg|png)$/) == null) {
        pic_error = "Ошибка: недопустимый формат изображения"
    }

    if (pic_error == "") {
        db.query('UPDATE users SET profile_picture = ? WHERE id = ?', [link, logged_user], 
        (error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
                res.redirect("/user/settings");
        })
    } else {
        db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
            if (error) {
                console.log("Error connecting to database")
            }
                res.render('user_settings', { user: results[0], picture_error: pic_error })
        })
    }
})

app.get('/user/requests/:id', (req, res) => {
    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    var res1;
    var res2;
    var res3;
    
    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res1 = results
    })

    db.query('SELECT * FROM requests WHERE id = ?', [req.params.id] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res2 = results
    })

    db.query('SELECT * FROM users', (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res3 = results
    })

    db.query("SELECT messages.id, request_id, message_admin, message_text, users.name as user_name, message_date, users.profile_picture FROM messages INNER JOIN users ON message_user = users.id WHERE request_id = ? ORDER BY messages.id", [req.params.id], (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res.render('user_requests_messanger', { messages: results, user: res1[0], req_id: req.params.id, data: { req: res2[0] } , users: res3 })
    })
})

app.get('/admin', (req, res) => {

    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    var new_req = 0;
    var inwork_req = 0;

    db.query('SELECT COUNT(*) as count FROM requests WHERE status = ?', [0] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
            new_req = results[0].count
    })

    db.query('SELECT COUNT(*) as count FROM requests WHERE status = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
            inwork_req = results[0].count
    })

    //console.log(new_req, inwork_req)

    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
            res.render('admin', { user: results[0], new_req, inwork_req })
    })

})

app.get('/admin/settings', (req, res) => {

    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
            res.render('admin_settings', { user: results[0], picture_error: "" })
    })

})

app.get('/user/settings', (req, res) => {

    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
            res.render('user_settings', { user: results[0], picture_error: "" })
    })

})

app.get('/admin/requests', (req, res) => {

    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    var res1;
    var res2;

    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res1 = results
    })
    db.query('SELECT * FROM users', (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res2 = results
    })
    db.query('SELECT requests.id, status, text, date, users.name as user FROM requests INNER JOIN users ON requests.user = users.id ORDER BY requests.id DESC', (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res.render('admin_requests', { requests: results, user: res1[0], users: res2, current_user: logged_user })
    })

}) 

app.get('/admin/requests/:id', (req, res) => {
    var { cookies } = req
    var logged_user = 1

    if ( "logged_user" in cookies ) {
        logged_user = cookies.logged_user
    } else {
        res.redirect("/");
    }

    var res1;
    var res2;
    var res3;
    
    db.query('SELECT * FROM users WHERE id = ?', [logged_user] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res1 = results
    })

    db.query('SELECT * FROM requests WHERE id = ?', [req.params.id] ,(error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res2 = results
    })

    db.query('SELECT * FROM users', (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res3 = results
    })

    db.query("SELECT messages.id, request_id, message_admin, message_text, users.name as user_name, message_date, users.profile_picture FROM messages INNER JOIN users ON message_user = users.id WHERE request_id = ? ORDER BY messages.id", [req.params.id], (error, results) => {
        if (error) {
            console.log("Error connecting to database")
        }
        res.render('admin_requests_messager', { messages: results, user: res1[0], req_id: req.params.id, data: { req: res2[0] } , users: res3 })
    })
}) 

server.listen(8080, () => {
    console.log('Server started: http://localhost:8080')
})
