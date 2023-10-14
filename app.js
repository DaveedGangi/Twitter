let express = require("express");
let app = express();

let { open } = require("sqlite");
let sqlite3 = require("sqlite3");

let jwt = require("jsonwebtoken");
let bcrypt = require("bcrypt");

let path = require("path");
let dbPath = path.join(__dirname, "twitterClone.db");

let database = null;
app.use(express.json());

let intDataBase = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error at ${e.message}`);
    process.exit(1);
  }
};
intDataBase();

app.post("/register/", async (request, response) => {
  let { username, password, name, gender } = request.body;
  let checkName = `
    SELECT 
    * 
    FROM 
    user 
    WHERE 
    username="${username}";`;
  let runCheckName = await database.get(checkName);
  if (runCheckName !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      let hashPassword = await bcrypt.hash(password, 10);
      let addingData = `
        INSERT INTO user 
        (username,password,name,gender) 
        VALUES 
        ("${username}","${hashPassword}","${name}","${gender}");`;
      let runAddingData = await database.run(addingData);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//api2
//authentication

const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "SECRET_KEY", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  let userName = `
    SELECT 
    * 
    FROM 
    user 
    WHERE 
    username="${username}";`;
  let runUserName = await database.get(userName);
  if (runUserName !== undefined) {
    payload = { username, userId: runUserName.user_Id };
    let comparePassword = await bcrypt.compare(password, runUserName.password);
    let jwtToken = jwt.sign(payload, "SECRET_KEY");
    if (comparePassword) {
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
//api3
let getFollowing = async (username) => {
  let getTheFollowing = `
    SELECT 
    following_user_id FROM follower 
    INNER JOIN user ON user.user_id=follower.follower_user_id 
    WHERE 
    user.username="${username}";`;
  let followingPeople = await database.all(getTheFollowing);
  let arrayOfIds = followingPeople.map(
    (eachUser) => eachUser.following_user_id
  );
  return arrayOfIds;
};

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  let { username } = request;
  let followingPeopleId = await getFollowing(username);
  let getTweetsQuery = `
    SELECT 
    username,tweet,date_time as dateTime 
    FROM user INNER JOIN tweet ON user.user_id=tweet.user_id 
    WHERE 
    user.user_id IN (${followingPeopleId}) 
    ORDER BY date_time DESC 
    LIMIT 4;`;
  let runTweets = await database.all(getTweetsQuery);
  response.send(runTweets);
});

//api4

app.get("/user/following/", authentication, async (request, response) => {
  const { username, userId } = request;
  const getFollowing = `SELECT name FROM follower 
  INNER JOIN user ON user.user_id = follower.following_user_id 
  WHERE follower_user_id='${userId}';`;
  const runGetFollowing = await database.all(getFollowing);
  response.send(runGetFollowing);
});

//api5
app.get("/user/followers/", authentication, async (request, response) => {
  let { username, userId } = request;
  let getFollowers = `
    SELECT 
    DISTINCT 
    name 
    FROM 
    follower 
    INNER JOIN user ON user.user_id=follower.follower_user_id
    WHERE 
    following_user_id='${userId}';`;
  let followers = await database.all(getFollowers);
  response.send(followers);
});

//api6
let tweetAccessVerification = async (request, response, next) => {
  let { userId } = request;
  let { tweetId } = request.params;
  let getTweetQuery = `SELECT 
    * 
    FROM 
    tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id 
    WHERE 
    tweet.tweet_id="${tweetId}" AND follower_user_id="${userId}";`;
  let tweet = await database.get(getTweetQuery);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};
app.get(
  "/tweets/:tweetId/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { username, userId } = request;
    const { tweetId } = request.params;
    let getTweetQuery = `SELECT tweet,

    (SELECT COUNT() FROM Like WHERE tweet_id="${tweetId}" AS likes,
    (SELECT COUNT() FROM reply WHERE tweet_id="${tweetId}" AS replies,
    date_time AS dateTime 

    FROM tweet 

    WHERE tweet.tweet_id="${tweetId}";`;
    const tweet = await database.get(getTweetQuery);
    response.send(tweet);
  }
);
//api7
app.get(
  "/tweets/:tweetId/likes/",

  authentication,
  tweetAccessVerification,

  async (request, response) => {
    const { tweetId } = request.params;
    let getLikesQuery = `SELECT username 
    FROM user INNER JOIN like ON user.user_id=like.user_id 
    WHERE 
    tweet_id="${tweetId}";`;
    let likedUsers = await database.all(getLikesQuery);
    let userArray = likedUsers.map((each) => each.username);
    response.send({ likes: userArray });
  }
);
//api8
app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    let { tweetId } = request.params;
    let getRepliedQuery = `
    SELECT name,reply FROM user INNER JOIN reply 
    ON user.user_Id=reply.user_id 
    WHERE tweet_id="${tweetId}";`;
    let repliedUsers = await database.all(getRepliedQuery);
    response.send({ replies: repliedUsers });
  }
);
//api9
app.get("/user/tweets/", authentication, async (request, response) => {
  let { userId } = request;
  let getTweetQuery = `
    SELECT tweet,
    COUNT(DISTINCT like_id) AS likes,
    COUNT(DISTINCT reply_id) AS replies, 
    date_time AS dateTime 
    FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id LEFT JOIN like ON tweet.tweet_id=like.tweet_id
    WHERE tweet.user_id=${userId} 
    GROUP BY tweet.tweet_id;`;
  let tweets = await database.all(getTweetQuery);
  response.send(tweets);
});
//api10
app.post("/user/tweets/", authentication, async (request, response) => {
  let { tweet } = request.body;
  let userId = parseInt(request.userId);
  let dateTime = new Date().toJSON().substring(0, 19).replace("T", " ");
  let createTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
    VALUES("${tweet}","${userId}","${dateTime}")`;
  await database.run(createTweetQuery);
  response.send("Created a Tweet");
});
//api11
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  let { tweetId } = request.params;
  let { userId } = request;
  let getTheTweetQueryS = `SELECT * FROM tweet WHERE user_id="${userId}" AND tweet_id="${tweetId}";`;
  let tweet = await database.get(getTheTweetQueryS);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    let deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id="${tweetId}";`;
    await database.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
});
module.exports = app;
