
const init = (firestore, portFromElm, portToElm) => {
  portFromElm.subscribe(([task, docOp]) => {
    switch (task) {
      case "CollectionSubscription":
        subscribeToCollection(firestore, portToElm, docOp);
        break;

      case "CreateDocument":
        createDocument(firestore, portToElm, docOp);
        break;

      case "GetDocument":
        getDocument(firestore, portToElm, docOp);
        break;

      case "UpdateDocument":
        updateDocument(firestore, portToElm, docOp);
        break;

      case "DeleteDocument":
        deleteDocument(firestore, portToElm, docOp);
        break;

      default:
        console.error("Unknown task for elm-firebase:", task);
        break;
    };
  });
}


const subscribeToCollection = (firestore, portToElm, collectionPath) => {
  firestore
    .collection(collectionPath)
    .onSnapshot(
      snapshot => {
        // TODO We Could see about mapping over the docChanges
        // and sending them in batches.
        // We could (List -> Collection) then Collection.union'ing them.
        // Would get rid of a bunch of processPortUpdate and updateIfChanged

        snapshot.docChanges().forEach(change => {
          // TODO - Do we still want this?? Especially in a library?
          // vvvvvvv -- vvvvvv -- vvvvvvv -- vvvvvv -- vvvvvvv -- vvvvvv
          //
          // We want "added" to flow into Elm as Updated events, not as
          // Created events. Reason: the Elm program is set up so it auto
          // redirects to the newly created document. This allows for
          // synchronous Event creation.

          if (change.type === "modified" || change.type === "added") {
            portToElm.send({
              operation: "documentUpdated",
              path: collectionPath,
              id: change.doc.id,
              state: change.doc.metadata.hasPendingWrites ? "cached" : "saved",
              data: change.doc.data(),
            });
          } else if (change.type === "removed") {
            portToElm.send({
              operation: "documentDeleted",
              path: collectionPath,
              id: change.doc.id,
              state: change.doc.metadata.hasPendingWrites ? "deleting" : "deleted",
              data: null,
            });
          } else {
            console.error("unknown doc change type", change.type);
          }
        });
      },
      err => {
        console.eror("subscribeToCollection", err)
    });
};


// Create Document
const createDocument = (firestore, portToElm, document) => {
  const collection = firestore.collection(document.path);
  let doc;

  if (document.id === "") {
    doc = collection.doc(); // Generate a unique ID
    document.id = doc.id;
  } else {
    doc = collection.doc(document.id);
  }

  portToElm.send({
    operation: "documentCreated",
    path: document.path,
    id: document.id,
    state: "new",
    data: document.value,
  });

  // If createOnSave, then save and update Elm
  if (!document.createOnSave) {
    return;
  }

  doc
    .set(document.value)
    .then(() => {
      portToElm.send({
        operation: "documentCreated",
        path: document.path,
        id: document.id,
        state: "saved",
        data: document.value,
      });
    })
    .catch(err => {
      console.error("createDocument", err)
    });
};


// Get Document
const getDocument = (firestore, portToElm, document) => {
  firestore
    .collection(document.path)
    .doc(document.id)
    .get()
    .then(doc => {
      portToElm.send({
        operation: "documentUpdated",
        path: document.path,
        id: document.id,
        state: "saved",
        data: doc.data(),
      });
    })
    .catch(err => {
      console.eror("getDocument", err);
    });
};


// Update Document
const updateDocument = (firestore, portToElm, document) => {
  firestore
    .collection(document.path)
    .doc(document.id)
    .update(document.data)
    .then(() => {
      portToElm.send({
        operation: "documentUpdated",
        path: document.path,
        id: document.id,
        state: "saved",
        data: document.data,
      });
    })
    .catch(err => {
      console.eror("updateDocument", err);
    });
};


// Delete Document
const deleteDocument = (firestore, portToElm, document) => {
  firestore
    .collection(document.path)
    .doc(document.id)
    .delete(document.data)
    .then(() => {
      portToElm.send({
        operation: "documentDeleted",
        path: document.path,
        id: document.id,
        state: "deleted",
        data: null,
      });
    })
    .catch(err => {
      console.eror("deleteDocument", err);
    });
};
