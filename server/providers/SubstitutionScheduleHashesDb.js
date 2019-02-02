const CloudantDb = require('../core-services/CloudantDb');

class SubstitutionScheduleHashesDb extends CloudantDb {
  constructor() {
    super('substitution-schedule-hashes', true);
  }

  crossCheck(checkList) {
    return new Promise((resolve, reject) => {
      const hashMap = new Map();

      this.find({ selector: {} })
        .then((hash) => {
          // Convert database result to hash map based on grade for ease of lookup.
          hash.docs.forEach(doc => hashMap.set(doc._id, { _rev: doc._rev, hash: doc.hash, substitutionSchedule: doc.substitutionSchedule }));

          // List of grades which schedule has changed for. Either we had no hash value before or it has changed.
          const changeList = checkList.filter(item => !hashMap.has(item.grade) || hashMap.get(item.grade).hash !== item.hash);

          // Add _rev to change list and proceed with next step.
          return changeList.map(item => Object.assign(item, { _rev: (hashMap.get(item.grade) || { })._rev }));
        })
        .then((changeList) => {
          // Update documents from change list in backing store.
          const promises = [];
          changeList.forEach(item => promises.push(this.insertDocument({ _id: item.grade, _rev: item._rev, hash: item.hash, substitutionSchedule: item.substitutionSchedule })));

          // Add old schedule to change list. This is needed as we want to compute actual delta in Pusher.
          // The reason why actual delta is not computed here is that this delta is device dependent and
          // for upper grades a course list. Here we just checkt that something has changed.
          const newChangeList = changeList.map(item => Object.assign(item, { oldSubstitutionSchedule: (hashMap.get(item.grade) || { }).substitutionSchedule }));

          // When done resolve.
          Promise.all(promises)
            .then(() => resolve(newChangeList))
            .catch((err) => {
              console.log(`Problem when updating substitution schedule hashes: ${err}`);
              resolve(newChangeList);
            });
        })
        .catch((err) => {
          console.log(`Substitution schedule hashes crosscheck failed with promise rejection: ${err}\n`);
          reject(err);
        });
    });
  }
}

module.exports = SubstitutionScheduleHashesDb;
