import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import sqlite from 'sqlite3';
import { IUser } from "../models/user";

const sqlite3 = sqlite.verbose();

export const conn = new sqlite3.Database('./cloudster.db', (err: Error | null) => {
   if (err) {
      console.log("Error");
   }
   else {
      console.log(randomUpper('cONNeCTed suCcESsfUlLy To tHe DatABasE'));
   }
});
export const Authorization = (req: Request, res: Response, next: NextFunction) => {
   const token = req.header('Authorization');
   if (!token || !token.startsWith('bearer ')) {
      res.status(401).send();
      return;
   }
   const decoded = jwt.decode(token.replace('bearer ', '')) as unknown as IUser;
   if (!decoded.key) {
      res.status(401).send();
      return;
   }

   conn.get(`SELECT '' FROM usuarios WHERE key='${decoded.key.trim()}'`,
      (error: any, row) => {
         if (error || !row) {
            res.status(401).json({ message: 'Unanthorized' });
            return;
         }
         return next();
      });

}
/**
* Nada, pone letras mayusculas de forma aleatoria en las palaras
* @param value la frase
*/
export const randomUpper = (value: string): string => {
   value = value.trim();
   let toReturn = "";
   [...value].forEach((item, index) => {
      if (Math.random() >= 0.40)
         toReturn += item.toLowerCase();
      else toReturn += item.toUpperCase();
   })

   return toReturn;
};