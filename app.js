const session = require('express-session');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();

// Configuração do MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Fleabag84@',
    database: 'doadiv'
});

connection.connect();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`Requisição para recurso estático: ${req.path}`);
    next();
});
app.use((req, res, next) => {
    console.log(`Recebendo solicitação: ${req.method} ${req.path}`);
    console.log('Body:', req.body);
    next();
});

app.use(express.static(__dirname));
app.use(session({
    secret: 'seu_segredo_aqui',  // Escolha um valor secreto para assinar o ID da sessão.
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Defina como true se estiver usando HTTPS
  }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.use(bodyParser.json());

// Rota para processar o cadastro de alunos
app.post('/usuario', (req, res) => {
    const { nome, email, senha ,confirmar_senha } = req.body;

    console.log("Dados recebidos:", req.body);  // Log dos dados recebidos
    console.log("Senha recebida:", senha);  // Log da senha

    if (!senha) {
        console.error("Senha não fornecida ou indefinida");
        res.send("Erro ao cadastrar. Senha não fornecida.");
        return;
    }

        
    if (senha !== confirmar_senha) {
        console.error("As senhas não coincidem");
        res.send("Erro ao cadastrar. As senhas não coincidem.");
        return;
    }

     const salt = bcrypt.genSaltSync(10);
     const hashedPassword = bcrypt.hashSync(senha, salt);
 


    const query = 'INSERT INTO dadosUsuario (nome, email, senha) VALUES (?,?,?)';
    connection.query(query, [nome, email, hashedPassword, confirmar_senha], (err, results) => {
        if (err) {
            console.error("Erro ao inserir os dados:", err);
            res.send("Erro ao cadastrar. Tente novamente.");
        } else {
            res.sendFile(__dirname + '/public/login.html');
        }
    });
});

// Rota para processar o cadastro de monitores
app.post('/Ong', (req, res) => {
    const { email, confimar_email, senha, confirmar_senha, nome, fotoComprovante, categoria, descricao } = req.body;
    console.log(senha);
    console.log("Dados recebidos:", req.body);  // Log dos dados recebidos
    console.log("Senha recebida:", senha);  // Log da senha

    if (!senha) {
        console.error("Senha não fornecida ou indefinida");
        res.send("Erro ao cadastrar. Senha não fornecida.");
        return;
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(senha, salt);

        const query = 'INSERT INTO dadosOng (email, senha, nome, fotoComprovante, categoria, descricao) VALUES (?, ?, ?, ?, ?, ?)';
        connection.query(query, [email, nome, fotoComprovante, categoria, descricao, hashedPassword], (err, results) => {
            if (err) {
                console.error("Erro ao inserir os dados:", err);
                res.send("Erro ao cadastrar. Tente novamente.");
            } else {
                res.sendFile(__dirname + '/public/login.html');
                
            }
        });
    });


// Rota para processar o login
app.post('/login', (req, res) => {
    console.log("Acessando rota /login");
    const { email, senha: senha} = req.body;
    console.log(`Dados de login recebidos: Email: ${email}, Senha: ${senha}`);

    const queryusuario = 'SELECT senha FROM dadosUsuario WHERE email = ?';
    connection.query(queryusuario, [email], (err, results) => {
        if (err) {
            console.error("Erro ao buscar o email na tabela Usuario:", err);
            res.status(500).send("Erro interno do servidor");
            return;
        }

        if (results.length === 0) {
            // Se o email não for encontrado na tabela Alunos, procuramos na tabela Monitores
            const queryong = 'SELECT senha FROM dadosOng WHERE email = ?';
            connection.query(queryong, [email], (err, results) => {
                if (err) {
                    console.error("Erro ao buscar o email na tabela Ong:", err);
                    res.status(500).send("Erro interno do servidor");
                    return;
                }
                
                if (results.length === 0) {
                    res.status(400).send("Email não encontrado");
                    return;
                }

                verifyPassword(results, "Ong");
            });
        } else {
            verifyPassword(results, "Usuario");
            
        }
    });

    function verifyPassword(results, userType) {
        const hashedPassword = results[0].senha;
    
        bcrypt.compare(senha, hashedPassword, (err, isMatch) => {
            if (err) {
                console.error("Erro ao comparar senha:", err);
                res.status(500).send("Erro interno do servidor");
                return;
            }
    
            if (!isMatch) {
                res.status(400).send("Senha incorreta");
                return;
            }else{
                
                if (userType === "Usuario") {
                    req.session.usuarioEmail = email;
                    console.log("Email do monitor na sessão:", req.session.usuarioEmail);
                    res.sendFile(__dirname + '/index.html');
                } else if (userType === "Ong") {
                    req.session.ongEmail = email;
                    console.log("Email do monitor na sessão:", req.session.ongEmail);
                    res.sendFile(__dirname + '/index.html'); //Arummar depois
                } else {
                    res.status(500).send("Erro ao determinar o tipo de usuário");
                }
            }
    
            
        });
    }
});

app.get('/perfil_ong', (req, res) => {
    if (!req.session.ongEmail) {
        return res.status(400).send("Monitor não autenticado");
    }

    const emailOng = req.session.ongEmail;
    const query = 'SELECT * FROM dadosOng WHERE email = ?';

    connection.query(query, [emailOng], (err, results) => {
        if (err) {
            console.error("Erro ao buscar os detalhes do monitor:", err);
            res.status(500).send("Erro interno do servidor");
            return;
        }

        if (results.length === 0) {
            res.status(400).send("Monitor não encontrado");
            return;
        }

        const monitorDetails = results[0];
        res.json(monitorDetails);
    });
});


app.get('/perfil_usuario', (req, res) => {
    if (!req.session.usuarioEmail) {
        return res.status(400).send("Aluno não autenticado");
    }

    const emailUsuario = req.session.usuarioEmail;
    const query = 'SELECT * FROM dadosUsuario WHERE email = ?';

    connection.query(query, [emailUsuario], (err, results) => {
        if (err) {
            console.error("Erro ao buscar os detalhes do usuario:", err);
            res.status(500).send("Erro interno do servidor");
            return;
        }

        if (results.length === 0) {
            res.status(400).send("Usuario não encontrado");
            return;
        }

        const usuarioDetails = results[0];
        res.json(usuarioDetails);
    });
});



app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Erro ao realizar logout:", err);
            return res.send("Erro ao realizar logout. Tente novamente.");
        }
        res.redirect('/login.html');  // Redireciona para a página de login após o logout
    });
});



app.post('/processar_recuperacao_senha', (req, res) => {
    const { email } = req.body;

    // Vamos verificar se o e-mail  correspondem a um registro no banco de dados
    const query = 'SELECT * FROM dadosUsuarios WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error("Erro ao buscar os detalhes do aluno:", err);
            return res.send("Erro interno do servidor. Tente novamente.");
        }

        if (results.length === 0) {
            return res.send("E-mail incorretos.");
        }

        // Se a correspondência for encontrada, gere uma senha temporária
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = bcrypt.genSaltSync(10);
        const hashedTempPassword = bcrypt.hashSync(tempPassword, salt);

        // Atualizar a senha no banco de dados
        const updateQuery = 'UPDATE dadosusuario SET senha = ? WHERE email = ? ';
        connection.query(updateQuery, [hashedTempPassword, email], (err, updateResults) => {
            if (err) {
                console.error("Erro ao atualizar a senha:", err);
                return res.send("Erro interno do servidor. Tente novamente.");
            }
            res.send(`Senha temporária gerada: ${tempPassword}. Use essa senha para entrar e, em seguida, mude-a.`);
        });
    });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let volunteerCount = 0; 

app.post('/', (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields) => {
    if (err) {
      res.status(500).send('Erro interno do servidor, volte a página ou entre novamente no site.');
      return;
    }

    const data = `Nome: ${fields.nome}\nTelefone: ${fields.telefone}\nEmail: ${fields.email}\nData de Nascimento: ${fields.nascimento}\nDisponibilidade: ${fields.disponibilidade}\n\n`;

    const fileName = `voluntario${++volunteerCount}.txt`;

    const filePath = path.join(__dirname, 'Voluntario', fileName);

    fs.writeFile(filePath, data, (err) => {
      if (!err) {
 
        res.redirect('/');
      } else {
        res.status(500).send('Erro interno do servidor, volte a página ou entre novamente no site.');
      }
    });
  });
});



app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
});