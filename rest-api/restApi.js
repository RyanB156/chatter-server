
const fs = require('fs');

/**
 * An object similar to http responses with a status code and either data or an error message
 */
class Result {
  constructor(status, data, error) {
    this.status = status;
    this.data = data;
    this.error = error;
  }
}

class Success extends Result {
  constructor(status, data) {
    super(status, data, '');
  }
}

class Failure extends Result {
  constructor(status, error) {
    super(status, '', error);
  }
}

module.exports = class RestAPI {

  constructor(dataPath, verbose=false) {
    this.dataPath = dataPath;
    this.verbose = verbose;

    if (!fs.existsSync(this.dataPath)) {
      fs.writeFileSync(this.dataPath, JSON.stringify({}));
    }
    if (this.verbose)
      console.log(`File ${dataPath} contains ${fs.readFileSync(this.dataPath)}`);
  }

  _saveData(data) {
    if (this.verbose)
      console.log(`_saveData - saving ${JSON.stringify(data)}`);
    fs.writeFileSync(this.dataPath, JSON.stringify(data));
  }

  /**
   * @return {Result} - A result object containing all the items found in storage
   */
  getAll() {
    let text = fs.readFileSync(this.dataPath);
    try {
      let items = JSON.parse(text);
      if (this.verbose)
        console.log(`getAll - Loaded ${text}`);

      for (let item in items) {
        console.log(item);
      }

      return new Success(200, items);
    } catch {
      if (this.verbose)
        console.log(`getAll - Could not read data, returning {}`);
      return new Success(200, {});
    }
  }

  /**
   * Retrieves the item with the specified id from storage
   * @param {any} id - The value of the attribute to search
   * @return {Result}
   */
  get(id) {
    let data = this.getAll().data;

    if (!(id in data)) {
      if (this.verbose)
        console.log(`get - Could not find ${id} in ${data}`);
      return new Failure(400, 'Item with index \'id\' could not be found');
    } else {
      if (this.verbose)
        console.log(`get - Found item ${JSON.stringify(data[id])} with index ${id}`);
      return new Success(200, data[id]);
    }

    
  }

  /**
   * Adds a new item to storage with an id 1 greater than the id of the last item
   * @param {any} item - The item to add to storage
   * @return {Result}
   */
  add(item) {

    if (this.verbose) {
      console.log(`add - Received ${JSON.stringify(item)}`);
    }

    let allItems = this.getAll().data;
    let lastIndex = -1;

    if (allItems != undefined) {
      for (let itemID in allItems) {
        if (this.verbose)
          console.log(`add - Checking id ${JSON.stringify(itemID)}\ndata[${itemID}]:${JSON.stringify(allItems[itemID])}`);
        if (allItems[itemID] === undefined) {
          continue;
        } else {
          lastIndex = allItems[itemID]['id'];
        }
      }
    }
    
    if (lastIndex === undefined) {
      lastIndex = -1;
    }

    if (this.verbose)
      console.log(`add - Creating index ${lastIndex + 1}`);
    lastIndex++;
    item['id'] = lastIndex;
    allItems[lastIndex] = item;
    this._saveData(allItems);
    return new Success(200, `${JSON.stringify(item)} added successfully`);
  }

  /**
   * Updates the item with the specified id with the new item
   * @param {number} id - The numerical id of the item to update 
   * @param {any} newItem - The new value to put into storage
   * @return {Result}
   */
  update(id, newItem) {
    let items = this.getAll().data;

    if (!(id in items)) {
      return new Failure(400, `Unable to find an item with id ${id}`);
    }

    if (this.verbose)
      console.log(`update - Changing item ${JSON.stringify(items[id])} to ${JSON.stringify(newItem)}`);
    
    items[id] = newItem;
    this._saveData(items);
    return new Success(200, `Item updated ${id} successfully`);
  }

  /**
   * Deletes the item with the specified id
   * @param {number} id - The numerical id of the item to delete
   * @return {Result}
   */
  delete(id) {
    let allItems = this.getAll().data;

    if (!(id in allItems)) {
      if (this.verbose)
        console.log(`delete - Item ${id} does not exist`)
      return new Failure(400, `Item ${id} does not exist`);
    } else {
      delete allItems[id];
      if (this.verbose) {
        console.log(`delete - Removed item ${id} successfully`);
      }
      this._saveData(allItems);
      return new Success(200, `Removed item ${id} successfully`);
    }

    
  }

}