const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { useInRouterContext } = require("react-router");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

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
      const { createdBy } = req.body;

      const existingArticles = await articleCollection
        .find({ createdBy })
        .toArray();

      const user = await usersCollection.findOne({ email: createdBy });

      if (!user.premiumTaken && existingArticles.length >= 1) {
        return res.send({
          success: false,
          code: 4099,
          message: "data not inserted",
        });
      }
      console.log(req.body);
      //   const newsArticle = ({
      //     title,
      // 	tickerText,
      //     description,
      //     publisher,
      //     tags,
      //     imageUrl,
      //     isApprove,
      //     isPremium,
      //     createdBy,
      //     createdAt,
      //   } = req.body);

      const newsArticle = req.body;

      const result = await articleCollection.insertOne(newsArticle);
      if (result) {
        console.log(result);
        res.status(200).send({ success: true });
      }
    });

    //fetch ticker text
    app.get("/news/tickers", async (req, res) => {
      const approvedArticles = await articleCollection
        .find(
          { "approvalStatus.isApprove": true },
          { projection: { tickerText: 1 } }
        )
        .toArray();

      const tickerTexts = approvedArticles
        .map((article) => article.tickerText)
        .filter(Boolean); // filter out any null or undefined values

      res.status(200).send(tickerTexts);
    });

    //article by publisher fetch api for pie chart
    app.get("/stats/articles-by-publisher", async (req, res) => {
      const result = await articleCollection
        .aggregate([{ $group: { _id: "$publisher", count: { $sum: 1 } } }])
        .toArray();

      res.status(200).send(result);
    });

    //article by user fetch api for bar chart
    app.get("/stats/articles-by-user", async (req, res) => {
      const result = await articleCollection
        .aggregate([
          {
            $group: {
              _id: "$createdBy", // email
              count: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: "userCollections", // name of the user collection
              localField: "_id", // createdBy (email) from article
              foreignField: "email", // email in user collection
              as: "userInfo",
            },
          },
          {
            $unwind: "$userInfo",
          },
          {
            $project: {
              _id: 0,
              email: "$_id",
              name: "$userInfo.name", 
              count: 1,
            },
          },
        ])
        .toArray();

      res.status(200).send(result);
    });

    //add publisher
    app.post("/publishers", async (req, res) => {
      const newPublisher = req.body;
      const result = await publisherCollection.insertOne(newPublisher);
      if (result) {
        res.status(200).send({ success: true });
      }
    });

    //user subscription activation api
    app.patch("/user/active-subscription/:email", async (req, res) => {
      const { email } = req.params;
      const { premiumTaken, subscriptionDuration } = req.body;
      //   console.log(email, premiumTaken, subscriptionDuration);
      const result = await usersCollection.updateOne(
        { email: email },
        {
          $set: {
            premiumTaken: premiumTaken,
            subscriptionDuration: subscriptionDuration,
          },
        }
      );
      res.send(result);
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
            "approvalStatus.isApprove": true,
          },
        }
      );
      //   console.log(result)
      if (result) {
        res.send(result);
      }
    });

    //myArticle fetch api
    app.get("/article/my-articles", async (req, res) => {
      const { email } = req.query;
      const result = await articleCollection
        .find({ createdBy: email })
        .toArray();
      if (result) {
        res.status(200).send(result);
      }
    });

    //article details api
    app.get("/article-details/:id", async (req, res) => {
      const { id } = req.params;
      const result = await articleCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //update article api
    app.put("/update-article/:id", async (req, res) => {
      const { id } = req.params;
      const { title, description, publisher, tags, imageUrl } = req.body;

      const result = await articleCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { title, description, publisher, tags, imageUrl },
        }
      );
      res.send(result);
    });

    //all article fetch/filter api with title search, publisher, tags in query
    app.get("/articles/all", async (req, res) => {
      const { publisher, tags, search } = req.query;
      const filters = { "approvalStatus.isApprove": true };
      if (publisher) {
        filters.publisher = publisher;
      }
      //   console.log(tags);
      if (tags) {
        filters.tags = tags;
      }

      if (search) {
        filters.title = { $regex: search, $options: "i" };
      }
      const articles = await articleCollection.find(filters).toArray();
      res.status(200).send(articles);
    });

    //make article premium api
    app.patch("/make-premium/:id", async (req, res) => {
      const id = req.params;
      const result = await articleCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isPremium: true } }
      );
      res.send(result);
    });

    //update article view count
    app.patch("/article/update-view/:id", async (req, res) => {
      const { id } = req.params;
      const result = await articleCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { viewCount: 1 } }
      );
      if (result) {
        res.status(200).send(result);
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
            "approvalStatus.isDecline": true,
            "approvalStatus.declineMessage": declineMessage,
          },
        }
      );
      res.send(result);
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

    //myarticle delete api
    app.delete("/my-articles/delete/:id", async (req, res) => {
      const { id } = req.params;
      const result = await articleCollection.deleteOne({
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

    //user role api
    app.get("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      //   console.log(user);
      if (!user) {
        return res.status(404).send({ message: "User Not Found!" });
      }
      if (user.premiumTaken) {
        return res.send({ role: "premium" });
      }
      res.send({ role: user.role || "user" });
    });

    //fetch user count
    app.get("/stats", async (req, res) => {
      const totalUsers = await usersCollection.countDocuments();
      const premiumUsers = await usersCollection.countDocuments({
        premiumTaken: { $ne: null },
      });
      const normalUsers = await usersCollection.countDocuments({
        premiumTaken: null,
      });

      const allArticles = await articleCollection.countDocuments();
      const premiumArticles = await articleCollection.countDocuments({
        isPremium: true,
      });

      res.status(200).send({
        premiumArticles,
        allArticles,
        totalUsers,
        normalUsers,
        premiumUsers,
      });
    });

    //fetch premium articles api
    app.get("/articles/premium", async (req, res) => {
      const { isPremium } = req.query;

      const query = { isPremium: true, "approvalStatus.isApprove": true };

      const articles = await articleCollection.find(query).toArray();
      res.status(200).send(articles);
    });

    //fetch publisher api
    app.get("/publishers", async (req, res) => {
      const publishers = await publisherCollection.find().toArray();
      res.status(200).send(publishers);
    });

    //treding article fetch api
    app.get("/articles/trending", async (req, res) => {
      const trendingArticles = await articleCollection
        .find({ "approvalStatus.isApprove": true })
        .sort({ viewCount: -1 })
        .limit(6)
        .toArray();
      res.status(200).send(trendingArticles);
    });

    //find user with email api
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      if (user) {
        res.status(200).send(user);
      }
    });

    //stripe payment intent
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { amountInCents } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",

          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
          id: paymentIntent.id,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: error.message });
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
