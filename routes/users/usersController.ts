import { Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import crypto, { pbkdf2Sync } from 'crypto';
import { IUser, IPreguntas } from '../../models/user';
import { connSync, getTokenKey, makeUserReg } from '../../util/util';
import { IResult } from '../../models/result';
import { IFile } from '../../models/files';
import { parseSize } from '../files/rangerController';
// import ranger from "./ranger";

export const getUsers = (
  req: Request,
  res: Response,
  sendRes = true
): IUser[] => {
  const { id: tokenID } = getTokenKey(req.headers.authorization);
  const id = req.params.id;
  const query = `SELECT
      \`id\`,
      \`usuario\`,
      \`nombre\`,
      \`apellido\`,
      \`desde\`,
      \`pregunta1\`,
      \`pregunta2\`,
      \`respuesta1\`,
      \`respuesta2\`,
      \`active\`,
      \`nivel\`
   FROM usuarios`;

  const where = id ? ` WHERE id='${id}';` : ';';

  const result = connSync.run(query + where);
  if (result.error) {
    res.status(500).json({ message: result.error });
    return [];
  }

  if (!sendRes) {
    return (result as unknown) as IUser[];
  } else if (id) {
    makeUserReg(tokenID, id, 'read');
    res.status(200).send(result[0] || {});
  } else {
    res.status(200).send(result);
  }
  return [];
};

export const checkUser = (req: Request, res: Response): void => {
  const user = getTokenKey(req.headers.authorization);
  const query = `
    SELECT
      \`id\`,
      \`usuario\`,
      \`nombre\`,
      \`apellido\`,
      \`desde\`,
      \`pregunta1\`,
      \`pregunta2\`,
      \`nivel\`
    FROM
      usuarios
    WHERE
      key='${user.key}';
  `;

  const result = connSync.run(query);
  if (result.error) {
    res.status(500).json({ message: result.error });
    return;
  } else if (!result[0]) {
    res.status(401).json();
    return;
  }
  makeUserReg(user.id, '', 'check', '', '', 'success');
  res.status(200).json(result[0]);
};

/**
 * Verifies whether or not theres is an user with the given
 * credentials and returns a token
 * @param body The User information
 * @param callback The callback function to be called afterwards
 */
// export const login = (body: IUser, callback: Function): void => {
export const login = (req: Request, res: Response): void => {
  const body = ({ ...req.body } as unknown) as IUser;
  if (!body.password || !body.usuario) {
    res.status(400).json({ message: `Faltan datos` });
    return;
  }

  const result: IResult = connSync.run(`
    SELECT * FROM usuarios
      WHERE
    usuario='${body.usuario.replace(/\'/g, "''")}'
    COLLATE NOCASE;
  `);

  if (result.error) {
    res.status(500).json({ name: 'SQLite error', message: result.error });
    return;
  }
  const [row] = (result as unknown) as IUser[];
  if (!row) {
    /* Unathorized */
    res.status(401).json({ message: `Credenciales incorrectas` });
    return;
  } else if (!row.active) {
    makeUserReg(row.id, '', 'login', '', '', 'inactive');
    res.status(401).json({
      message: `El usuario se encuentra suspendido. Comuniquese con el adminitrador.`,
    });
    return;
  } else if (
    row.password.trim() !== body.password.trim() ||
    row.intentos >= 3
  ) {
    connSync.run(`UPDATE usuarios
      SET
        intentos=intentos+1
      WHERE
        usuario='${body.usuario.replace(/\'/g, "''")}'
      COLLATE NOCASE;`);
    /* Unathorized */
    makeUserReg(row.id, '', 'login', '', '', 'fail');
    const message =
      ++row.intentos >= 3
        ? `Bloqueado por multiples intentos fallidos`
        : `Credenciales incorrectas.`;
    res.status(401).send({ message });
  } else {
    makeUserReg(row.id, '', 'login', '', '', 'success');
    const key = crypto.randomBytes(16).toString('hex');

    connSync.run(`
      UPDATE usuarios SET
        intentos=0,
        key='${key}'
      WHERE
        usuario='${body.usuario.replace(/\'/g, "''")}'
        COLLATE NOCASE;`);
    const token = hashToken(row, key);
    res.status(200).send({
      response: `Grant access`,
      token,
      user: {
        ...row,
        respuesta2: undefined,
        respuesta1: undefined,
        password: undefined,
        intentos: undefined,
      },
    });
    return;
  }
};

/**
 * Makes a new entry if all the conditions are met,
 * returns the user + its access key as a JWT
 * @param body The user information
 * @param callback The callback function to be called afterwards
 */
export const register = (req: Request, res: Response): void => {
  const body = ({ ...req.body } as unknown) as IUser;
  /* Validar que tenga todos los campos */
  if (!body.usuario) {
    /* BadRequest */
    res.status(400).json({code: 1 ,message: `Falta Usuario!`});
    return;
  } else if (!body.nombre) {
    /* BadRequest */
    res.status(400).json({code: 2 ,message: `Falta nombre!`});
    return;
  } else if (!body.password) {
    /* BadRequest */
    res.status(400).json({code: 3 ,message: `Falta contraseña`});
    return;
  } else if (!body.pregunta1 || !body.pregunta2) {
    /* BadRequest */
    res.status(400).json({code: 4 ,message: `Falta pregunta secreta`});
    return;
  } else if (!body.respuesta1 || !body.respuesta2) {
    /* BadRequest */
    res.status(400).json({code: 5 ,message: `Falta respuesta a la pregunta secreta`});
    return;
  }
  /* Llegados a este punto se asume que tiene todos los campos */
  const userExists = connSync.run(`
      SELECT 1 FROM
         usuarios
      WHERE
         usuario='${body.usuario.replace(/\'/g, "''")}'
      `);

  if(userExists.error) {
    res.status(500).json({error: userExists.error});
    return;
  }
  if (userExists[0]) {
    res.status(400).json({code: 6 ,message: `El nombre de usuario ya existe`});
    return;
  }
  const id = crypto.randomBytes(16).toString('hex');

  const result = connSync.run(`
    INSERT INTO usuarios(
      \`id\`
      ,\`nombre\`
      ,\`apellido\`
      ,\`password\`
      ,\`desde\`
      ,\`usuario\`
      ,\`pregunta1\`
      ,\`pregunta2\`
      ,\`respuesta1\`
      ,\`respuesta2\`
      ,\`nivel\`
      ,\`active\`
    ) VALUES(
      '${id}',
      '${body.nombre.replace(/\'/g, "''")}',
      '${body.apellido.replace(/\'/g, "''")}',
      '${body.password}',
      date(),
      '${body.usuario.replace(/\'/g, "''")}',
      ${body.pregunta1},
      ${body.pregunta2},
      '${body.respuesta1.replace(/\'/g, "''")}',
      '${body.respuesta2.replace(/\'/g, "''")}',
      1,
      0
    )`);
  if (result.error) {
    res.status(500).json({ ...result.error });
    return;
  }
  const [row] = (connSync.run(`
    SELECT * FROM
      usuarios
    WHERE
      usuario='${body.usuario.replace(/\'/g, "''")}'
    `) as unknown) as IUser[];
  makeUserReg(row.id, '', 'register');
  res.status(200).json({
    message: `Registrado satisfactoriamente. Contacta a un administrador para que active tu cuenta.`,
  });
};

/**
 * Updates the user info, if everything goes as espected,
 * then it retrieves the updated information
 * @param req The incoming request
 * @param res The outgoing response
 */
export const updateUserData = (req: Request, res: Response): void => {
  const body = (req.body as unknown) as IUser;

  const token = getTokenKey(req.headers.authorization);
  const { id, nivel } = token;
  if (
    (req.params.id !== id && nivel < 5) ||
    (nivel < 5 && body.hasOwnProperty('active'))
  ) {
    res.status(401).json({ message: `No tienes los permisos` });
    return;
  }

  const [row] = (connSync.run(
    `SELECT * FROM usuarios WHERE id='${req.params.id}' COLLATE NOCASE;`
  ) as unknown) as IUser[];
  if (!row) {
    res.status(400).json({ message: `El usuario no existe` });
    return;
  }

  let query: string = 'UPDATE usuarios SET ';
  /*  Loop to add all the fields in the database */
  const keys = [
    { name: 'usuario', has: true },
    { name: 'nombre', has: true },
    { name: 'apellido', has: true },
    { name: 'password', has: true },
    { name: 'pregunta1', has: false },
    { name: 'respuesta1', has: true },
    { name: 'pregunta2', has: false },
    { name: 'respuesta2', has: true },
    { name: 'nivel', has: false },
    { name: 'active', has: false },
  ];
  keys.forEach((key) => {
    const { name, has } = key;
    if (body.hasOwnProperty(name)) {
      if (has) query += ` ${name}='${body[name].replace(/\'/g, "''")}',`;
      else query += ` ${name}=${body[name]},`;
    }
  });
  query.slice(0, -1);
  query += ` intentos=0 WHERE id='${req.params.id}' COLLATE NOCASE;`;
  /* runs the update query  */
  const result = connSync.run(query);
  if (result.error) {
    res.status(500).json({ message: result.error });
    return;
  }

  let regQuery = `
    INSERT INTO registros (
      performedBy,
      usuario,
      accion,
      old_value,
      new_value,
      campo,
      fecha
    ) values `;
  const time = new Date().getTime();
  Object.keys(row).forEach((key) => {
    if (body.hasOwnProperty(key) && body[key] !== row[key]) {
      regQuery += `(
        '${id}',
        '${row.id}',
        'modified',
        '${row[key].toString()}',
        '${body[key].toString()}',
        '${key}',
        ${time}
      ),`;
    }
  });
  regQuery.slice(0, -1);
  connSync.run(regQuery + ';');

  const [newrow] = (connSync.run(`
    SELECT * FROM
      usuarios
    WHERE
      id='${req.params.id}' COLLATE NOCASE;
  `) as unknown) as IUser[];

  /* Oll Korrect */
  const hideToken = req.params.id !== id;
  res.status(200).json({
    response: `Usuario actualizado`,
    token: hideToken ? '' : hashToken(newrow),
    user: hideToken
      ? ''
      : {
          ...newrow,
          respuesta2: undefined,
          respuesta1: undefined,
          password: undefined,
          intentos: undefined,
        },
  });
}; // updateUserData

/**
 * Deletes an user from the database;
 * @param req The incoming request
 * @param res The outgoing response
 */
export const deleteUser = (req: Request, res: Response): void => {
  const query = `
   DELETE FROM
      usuarios
   WHERE
      \`id\`='${req.params.id}';`;

  const result = connSync.run(query);
  if (result.error) {
    res.status(500).json({ message: result.error });
    return;
  }

  res.status(200).json({ message: 'oll korrect' });
};

/**
 * Sends back all the questions
 * @param req The incoming request
 * @param res The outgoing response
 */
export const getQuestions = (req: Request, res: Response) => {
  const query = `SELECT * FROM preguntas`;

  const rows: { pregunta: string; id: number } = (connSync.run(
    query
  ) as unknown) as { pregunta: string; id: number };
  res.status(200).json(rows);
};

/**
 * Retrieves the questions selected by a specific user
 * @param req The incoming request
 * @param res The outgoing response
 */
export const getUserQuestions = (req: Request, res: Response): void => {
  const query = `SELECT
      \`preguntas\`.\`id\` as id_pregunta,
      \`pregunta1\`,
      \`pregunta2\`,
      \`usuario\`,
      \`usuarios\`.\`id\` as id_usuario,
      \`usuarios\`.\`active\`,
      \`pregunta\`
   FROM
      \`usuarios\`
   INNER JOIN
      \`preguntas\`
   ON
      \`preguntas\`.\`id\`=\`usuarios\`.\`pregunta1\`
   OR
      \`preguntas\`.\`id\`=\`usuarios\`.\`pregunta2\`
   WHERE
      \`usuarios\`.\`usuario\`='${req.params.usuario.replace(
        /\'/g,
        "''"
      )}' COLLATE NOCASE;`;

  const rows = connSync.run(query);
  if (rows.error) {
    res.status(500).json({ message: rows.error });
    return;
  }
  if (!rows || !rows.length) {
    res.status(404).json({ message: 'El usuario ingresado no existe.' });
    return;
  }
  if (!rows[0].active) {
    res.status(401).json({
      message: `El usuario se encuentra suspendido. Comuniquese con el adminitrador.`,
    });
    return;
  }
  const pregunta1: IPreguntas = rows.find(
    (a: IPreguntas) => a.id_pregunta === a.pregunta1
  ) as IPreguntas;
  const pregunta2: IPreguntas = rows.find(
    (a: IPreguntas) => a.id_pregunta === a.pregunta2
  ) as IPreguntas;
  /* Sends username, userid, and both questions */
  res.status(200).json({
    usuario: rows[0].usuario,
    id_usuario: rows[0].id_usuario,
    pregunta1: pregunta1?.pregunta,
    pregunta2: pregunta2?.pregunta,
  });
};

/**
 * Verifies whether or not the answers to the given questions match what is
 * stores in the database, if they do, a new key to renew the password is sent
 * @param req The incoming request
 * @param res The outgoing response
 */
export const checkUserQuestions = (req: Request, res: Response): void => {
  const id = req.params.id;
  const { respuesta1, respuesta2 } = req.body;
  const query = `SELECT * FROM usuarios WHERE id='${id}' COLLATE NOCASE;`;

  const rows: IResult = connSync.run(query);
  if (rows.error) {
    res.status(500).json({message: rows.error});
    return;
  }

  const [row] = (rows as unknown) as IUser[];
  if (
    row.respuesta1.toLowerCase() === respuesta1.toLowerCase() &&
    row.respuesta2.toLowerCase() === respuesta2.toLowerCase()
  ) {
    res.status(200).json({
      response: `Grant access`,
      token: jwt.sign(
        {
          id: row.id,
          key: row.key,
        },
        'supersecretkeythatnobodyisgonnaguess'
      ),
    });
    return;
  } else res.status(401).json({ message: 'Las respuestas no concuerdan' });
};

export const getFilesByUser = (req: Request, res: Response): void => {
  const [user] = getUsers(req, res, false);

  const files: IFile[] = connSync
    .run(
      `SELECT * FROM
            archivos
         WHERE
            usuario = ?
         AND
            nivel<=?
         COLLATE NOCASE`,
      [user.id, user.nivel]
    )
    .map((f: IFile) => {
      return { ...f, isFile: f.isFile ? true : false };
    });

  const [{ totalSize = 0 }] = (connSync.run(`
    SELECT SUM(fullSize) as totalSize FROM
      archivos
    WHERE
      usuario = '${user.id}'
    AND
      nivel<=${user.nivel}
    COLLATE NOCASE`) as unknown) as { totalSize: number }[];

  const query = `
    SELECT ext as name, count(ino) as value FROM
      archivos
    WHERE
      usuario = '${user.id}'
    AND
      nivel<=${user.nivel}
    GROUP BY
      ext
    ORDER BY
      value DESC
    LIMIT 10
  `;

  const chartData = (connSync.run(query) as unknown) as {
    name: string;
    value: number;
  }[];
  const parsedSize: string = parseSize(totalSize);

  const mappedData = chartData.map(({ name, value }) => ({
    value,
    name: !name ? 'carpeta' : name === '~' ? 'sin ext' : name,
  }));

  res.status(200).json({
    files,
    totalSize,
    parsedSize,
    chartData: mappedData,
  });
};

/**
 * Creates a jwt based on an user info
 */
const hashToken = (user: IUser, key?: string): string => {
  const now = new Date();
  return jwt.sign(
    {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      apellido: user.apellido,
      // password: user.password,
      nivel: user.nivel,
      key: key || user.key,
      expires: now.setHours(now.getHours() + 1),
    },
    'supersecretkeythatnobodyisgonnaguess'
  );
};

const hashPassword = (password: string) => {
  const iterations = 5;
  const salt = 'iwannadie';
  const hash = pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  return hash;
};
