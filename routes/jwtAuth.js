const router = require("express").Router();
const conn = require("../db");
const bcrypt = require("bcrypt");
const jwtGenerator = require("../utils/jwtGenerator");
const validInfo = require("../middleware/validInfo");
const autorizar = require("../middleware/authorization");
require('dotenv').config();

// router do form de registro de usuário

router.post("/register", validInfo, async (req,res)=>{
    try {
        // 1. destructure do formulário de registro > req.body (nome, email, senha)

        const {nome, email, senha} = req.body;

        // 2. verificar se o usuário existe (se o usuário existe, retornar erro)

        const usuario = await conn.query("SELECT * FROM usuarios WHERE email_usuario = $1", [email]);

        if(usuario.rows.length !== 0) {
            return res.status(401).send("Usuário já cadastrado!");
        }

        // 3. encriptar senha do usuário com Bcrypt

        const saltRound = 10;
        const salt = await bcrypt.genSalt(saltRound);
        const bcryptSenha = await bcrypt.hash(senha, salt);

        // 4. inserir novo usuário na base de dados

        const novoUsuario = await conn.query(
            "INSERT INTO usuarios (nome_usuario, email_usuario, senha_usuario) VALUES ($1, $2, $3) RETURNING *",
            [nome, email, bcryptSenha]
        );

        // 5. atribuir token jwt

        const token = jwtGenerator(novoUsuario.rows[0].id_usuario, process.env.permissoesPadrao);
        res.json({token});

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erro no Servidor");
    }
});

// router do form de login

router.post("/login", validInfo, async (req, res) => {
    try {
        // 1. destructure das informações do formulário de login > req.body (email, senha)
        const { email, senha } = req.body;

        // 2. confere se o usuário existe (se não existe dispara um erro)
        
        const usuario = await conn.query(
            "SELECT * FROM usuarios WHERE email_usuario = $1",
            [email]
        );

        if (usuario.rows.length === 0) {
            return res.status(401).send("Senha ou usuário incorretos");
        }

        // 3. checa se a senha informada é a mesma registrada no banco
        
        const senhaValida = await bcrypt.compare(senha, usuario.rows[0].senha_usuario);

        if (!senhaValida) {
            return res.status(401).json("Usuário ou senha incorretos");
        }

        // 4. consultar permissoes do usuario

        const permissoes = await conn.query("SELECT permissoes FROM perfis where perfil = $1", [usuario.rows[0].perfil_usuario]);

        // 5. atribuir token jwt

        
        if (!usuario.rows[0].acesso_permitido){
            return res.status(401).json("Usuário não autorizado. Fale com o administrador");
        }
        
        const token = jwtGenerator(usuario.rows[0].id_usuario, permissoes.rows[0].permissoes);
        res.send({token});

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erro no Servidor");
    }
});

router.get("/is-verify", autorizar, async (req, res) => {
    try {
        res.json(true);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Erro de servidor");
    }
});


module.exports = router;