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
    const usersCollection = client
      .db("headLinerDB")
      .collection("userCollections");
    const articleCollection = client
      .db("headLinerDB")
      .collection("articleCollection");

    //all users api
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      if (users) {
        res.status(200).send(users);
      }
    });
	
    //adding new user to db
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(200).send({ message: "User allready exist" });
      }
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      if (result) {
        res.status(200).send({ success: true });
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
