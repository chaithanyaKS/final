## Installation

```
cd final
npm install
npm start
```

`npm start` starts the development server to start peerjs server open a new terminal session

```
peerjs --port 3001
```

To start using the ML model we have to serve it by creating a local server. First navigate into the model directory and run the following command

```
 cd output/new_model
 http-server -c1 --cors .
```

To create a the database run

```
npx sequelize-cli init
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Project uses MYSQL as the database
