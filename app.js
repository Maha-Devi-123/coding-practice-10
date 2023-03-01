//importing modules
const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db;
//Installing DB and Server
const dbAndServerInstallation = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running!!");
    });
  } catch (error) {
    console.log(`Database Error: ${error.message}`);
    process.exit(1);
  }
};
dbAndServerInstallation();

//functions for changing text case to camelCase
const ChangeCase = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

const districtCase = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};
//middleware function to authenticate user
const authenticateUser = (request, response, next) => {
  const jwtToken = request.headers["authorization"];
  let userToken;
  if (jwtToken !== undefined) {
    userToken = jwtToken.split(" ")[1];
  }
  if (userToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const isCorrectToken = jwt.verify(userToken, "SECRETKEY", (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const isUserInDB = `SELECT * 
  FROM 
  user
   WHERE 
   username="${username}";`;
  const DBuser = await db.get(isUserInDB);
  if (DBuser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(password, DBuser.password);
    if (isCorrectPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRETKEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// get all states

app.get("/states/", authenticateUser, async (request, response) => {
  const queryToGetAllStates = `SELECT * 
  FROM 
  state 
  ORDER BY 
  state_id;`;
  const AllStates = await db.all(queryToGetAllStates);
  response.send(AllStates.map(ChangeCase));
});

//get specific state details by state id

app.get("/states/:stateId/", authenticateUser, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetails = `SELECT *
   FROM 
   state 
   WHERE 
   state_id=${stateId};`;
  const stateDetails = await db.get(getStateDetails);
  response.send(ChangeCase(stateDetails));
});

//create a district in district table

app.post("/districts/", authenticateUser, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const queryToAddDistrict = `
    INSERT INtO district 
    (district_name,
        state_id,
        cases,
        cured,
        active,
        deaths)
    VALUES("${districtName}",
  ${stateId},
  ${cases},
  ${cured},
  ${active},
  ${deaths});
    `;
  await db.run(queryToAddDistrict);
  response.send("District Successfully Added");
});

//GET specific district by id
app.get(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const getdistrictDetails = `SELECT * 
    FROM 
    district 
    WHERE
     district_id=${districtId};`;
    const districtDetails = await db.get(getdistrictDetails);
    response.send(districtCase(districtDetails));
  }
);

//Delete a district by district id
app.delete(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const queryToDeleteDistrict = `DELETE FROM 
    district 
    WHERE 
    district_id=${districtId};`;
    await db.run(queryToDeleteDistrict);
    response.send("District Removed");
  }
);

//update district details in district table by district id
app.put(
  "/districts/:districtId/",
  authenticateUser,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const queryToUpdateDistrict = `UPDATE
     district 
   SET 
   district_name="${districtName}",
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
  WHERE district_id = ${districtId};`;
    await db.run(queryToUpdateDistrict);
    response.send("District Details Updated");
  }
);

//get stats of a state by adding all the district details of cases
app.get(
  "/states/:stateId/stats/",
  authenticateUser,
  async (request, response) => {
    const { stateId } = request.params;
    const getDistrictsOfState = `
    SELECT 
    cases,cured,active,deaths 
    FROM district 
    WHERE state_id = ${stateId};`;
    const districtCasesArray = await db.all(getDistrictsOfState);
    const newArray = {
      totalCases: 0,
      totalCured: 0,
      totalActive: 0,
      totalDeaths: 0,
    };
    districtCasesArray.map((obj) => {
      newArray.totalCases = obj.cases + newArray.totalCases;
      newArray.totalCured = obj.cured + newArray.totalCured;
      newArray.totalActive = obj.active + newArray.totalActive;
      newArray.totalDeaths = obj.deaths + newArray.totalDeaths;
    });
    response.send(newArray);
  }
);

module.exports = app;
