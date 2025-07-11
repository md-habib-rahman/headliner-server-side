const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xgjcv8g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Headliner API is running");
});

async function run() {
  try {
    await client.connect();

    //collections
    const usersCollection = client
      .db("headLinerDB")
      .collection("userCollections");
    const articleCollection = client
      .db("headLinerDB")
      .collection("articleCollection");
    const publisherCollection = client
      .db("headLinerDB")
      .collection("publisherCollection");

    //all users api
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      if (users) {
        res.status(200).send(users);
      }
    });

    //update user role
    app.patch("/users/role/:email", async (req, res) => {
      const { email } = req.params;
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { email: email },
        { $set: { role } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false });
      }
      res.status(200).send({ success: true });
    });

    //adding new user to db
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(200).send({ success: false });
      }
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      if (result) {
        res.status(200).send({ success: true });
      }
    });

    //get articles with user joined api
    app.get("/articles-with-users", async (req, res) => {
      const result = await articleCollection
        .aggregate([
          {
            $lookup: {
              from: "userCollections",
              localField: "createdBy",
              foreignField: "email",
              as: "articleWithUserInfo",
            },
          },
          {
            $unwind: "$articleWithUserInfo",
          },
        ])
        .toArray();
      //   console.dir(result);
      if (result) {
        res.status(200).send(result);
      }
    });

    //add article api
    app.post("/articles", async (req, res) => {
      const newArticle = ({
        title,
        description,
        publisher,
        tags,
        imageUrl,
        isApprove,
        isPremium,
        createdBy,
        createdAt,
      } = req.body);

      const result = await articleCollection.insertOne(newArticle);
      if (result) {
        res.status(200).send({ success: true });
      }
    });

    //add publisher
    app.post("/publishers", async (req, res) => {
      const newPublisher = req.body;
      const result = await publisherCollection.insertOne(newPublisher);
      if (result) {
        res.status(200).send({ success: true });
      }
    });

    //get publisher
    app.get("/publishers", async (req, res) => {
      const result = await publisherCollection.find({}).toArray();

      if (result) {
        res.status(200).send(result);
      }
    });

    //update article approval status
    app.patch("/article/allow-approval/:id", async (req, res) => {
      const { id } = req.params;
      const result = await articleCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            "approvalStatus[0].isApprove": true,
          },
        }
      );
      if (result.upsertedCount === 1) {
        res.status(200).send({ success: true });
      }
    });

    //update decline message
    app.patch("/article/decline/:id", async (req, res) => {
      const { id } = req.params;
      const { declineMessage } = req.body;

      const result = await articleCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            "approvalStatus[1].isDecline": true,
            "approvalStatus[2].declineMessage": declineMessage,
          },
        }
      );
      res.send({ success: true });
    });

    //edit publisher
    app.put("/publishers/:pub_id", async (req, res) => {
      const pub_id = req.params.pub_id;
      const { name, image } = req.body;
      const result = await publisherCollection.updateOne(
        {
          _id: new ObjectId(pub_id),
        },
        {
          $set: {
            name,
            image,
          },
        }
      );
      if (result) {
        res.status(200).send({ success: true });
      }
    });

    //delete publisher api
    app.delete("/publishers/:id", async (req, res) => {
      const id = req.params.id;
      const result = await publisherCollection.deleteOne({
        _id: new ObjectId(id),
      });
      if (result.deletedCount === 1) {
        res.status(200).send({ success: true });
      }
    });

    //delete article api
    app.delete("/article/:id", async (req, res) => {
      const { id } = req.params;
      const result = await articleCollection.deleteOne({
        _id: new ObjectId(id),
      });
      if (result.deletedCount === 1) {
        res.status(200).send({ success: true });
      }
    });

    app.get("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(404).send({ message: "User Not Found!" });
      }
      res.send({ role: user.role || "user" });
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      if (user) {
        res.status(200).send(user);
      }
    });

    await client.db("headLinerDB").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);

app.listen(port, () => {
  console.log(`✅ Server running on Port: ${port}`);
});
