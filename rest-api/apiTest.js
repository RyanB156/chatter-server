
let RestAPI = require('./restAPI');

class Data {
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }
}

let api = new RestAPI('./data.json', true);

for (let i = 1; i < 21; i++) {
  api.delete(i);
}

console.log(api.getAll().data);
