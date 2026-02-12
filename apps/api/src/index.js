import dotenv from "dotenv";

dotenv.config()
 
import http from "http";
import express from "express";
import cors from "cors";

import { WebSocketServer } from "ws";

const PORT = Number(process.env.API_PORT || 4000)

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req,res)=>{
    res.json({ok:true})

})

const server = http.createServer(app)

const wss = new WebSocketServer({ server, path: "/ws" });


wss.on("connection", (ws,req)=>{
    ws.send(JSON.stringify({type: "helo", ts:Date.now()}))

    const interval = setInterval(() => {
        if (ws.readyState === ws.OPEN){
            ws.send(JSON.stringify({type: "tick", ts:Date.now()}))

        }
    }, 1000);

    ws.on("message", (data)=> {
        let msg = null;
        try{
            msg = JSON.parse(String(data));

        } catch{
            msg = {type: "raw", data: String(data)};
        }

        if (ws.readyState === ws.OPEN){
            ws.send(JSON.stringify({type: "echo", msg, ts:Date.now()}))
        }
    })

    ws.on("close", () => clearInterval(interval));
    ws.on("error", () => clearInterval(interval));

})

server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`WS listening on ws://localhost:${PORT}/ws`);
});