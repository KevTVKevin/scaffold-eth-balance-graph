import React, { useCallback, useEffect, useState } from "react";
import "antd/dist/antd.css";
import { StaticJsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import "./App.css";
import { Button, Alert } from "antd";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { useUserAddress } from "eth-hooks";
import { formatEther, parseEther } from "@ethersproject/units";
import { MDBCol, MDBContainer, MDBRow } from "mdbreact";
import { Line } from "react-chartjs-2";
import { Container } from "react-bootstrap";
import { async } from "q";
import M from "minimatch";
import { useExchangePrice, useGasPrice, useUserProvider, useBalance, useOnBlock } from "./hooks";
import { Header, Account, ThemeSwitch } from "./components";
import { Transactor } from "./helpers";
// import Hints from "./Hints";
import { INFURA_ID, NETWORK, NETWORKS } from "./constants";

const axios = require("axios");
/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/austintgriffith/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/

// const serverUrl = "https://backend.ether.delivery:49832/"
const serverUrl = "http://localhost:49832/";

/// 📡 What chain are your contracts deployed to?
const targetNetwork = NETWORKS.mainnet; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
// Using StaticJsonRpcProvider as the chainId won't change see https://github.com/ethers-io/ethers.js/issues/901
const scaffoldEthProvider = new StaticJsonRpcProvider("https://rpc.scaffoldeth.io:48544");
const mainnetInfura = new StaticJsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID);
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_I

// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new StaticJsonRpcProvider(localProviderUrlFromEnv);

// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

async function getAllEthereumTransactions(address, block) {
  const test = await fetch(
    `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=${block}&endblock=latest&sort=asc&apikey=I7K8X9VNXHVE8ZQTRY3JDKE6DR42UYBPUM`,
  )
    .then(res => {
      return res.json();
    })
    .then(res => {
      let exists = false;
      try {
        exists = res.result;
      } catch (e) {
        exists = false;
      }
      if (exists) {
        return exists;
      }
      return false;
    });
  return test;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fillDates(data) {
  const dates = data.graphDates;
  const currentDate = new Date();
  const currentMonth = monthNames[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();
  let index = 0;
  const firstDate = dates[index].split(" ");
  const firstMonth = firstDate[0];
  const firstYear = firstDate[1];
  let nextDate = "";
  let nextMonth = "";
  let nextYear = "";
  while (currentMonth !== nextMonth) {
    let date = dates[index].split(" ");
    let month = date[0];
    let year = date[1];
    index += 1;
    if (dates.length === index) {
      index -= 1;
    }
    nextDate = dates[index].split(" ");
    nextMonth = nextDate[0];
    nextYear = nextDate[1];
    if (month === nextMonth) {
      nextMonth = currentMonth;
    }
    let nextMonthName = monthNames[monthNames.indexOf(month) + 1];
    while (nextMonth !== nextMonthName) {
      if (nextMonth === currentMonth) {
        dates.splice(dates.length, 0, nextMonthName + " " + year);
      } else {
        dates.splice(index, 0, nextMonthName + " " + year);
      }
      date = dates[index].split(" ");
      month = date[0];
      year = date[1];
      nextMonthName = monthNames[monthNames.indexOf(month) + 1];
      index += 1;
      nextDate = dates[index].split(" ");
      nextMonth = nextDate[0];
      nextYear = nextDate[1];
    }
    if (nextMonth === nextMonthName && nextMonth === currentMonth) {
      dates.splice(dates.length, 0, nextMonth + " " + year);
    }
  }
  console.log(dates);

  /* dates.forEach((date, key) => {
    const splittedDate = date.split(" ");
    const month = splittedDate[0];
    const year = splittedDate[1];
    
  }); */
  return data;
}

async function ethereumTransactionProvider(address) {
  const transactions = await getAllEthereumTransactions(address, 0);
  const graphDates = [];
  const data = [];
  let value = 0;
  Object.keys(transactions).map((key, key2) => {
    const transaction = transactions[key];
    const timestamp = parseInt(transaction.timeStamp, 10);
    const date = new Date(timestamp * 1000);
    if (
      !Number.isNaN(date.getMonth()) &&
      !Number.isNaN(date.getFullYear()) &&
      (transaction.value !== 0 || transaction.from === address)
    ) {
      const dateString = monthNames[date.getMonth()] + " " + date.getFullYear();
      if (transaction.from.toLowerCase() !== address.toLowerCase()) {
        value += parseInt(transaction.value, 10);
      } else {
        value -=
          parseInt(transaction.gasPrice, 10) * parseInt(transaction.gasUsed, 10) + parseInt(transaction.value, 10);
      }
      if (graphDates.includes(dateString)) {
        const index = graphDates.indexOf(dateString);
        data[index] = (value / 1e18).toString();
      } else {
        graphDates.push(dateString);
        data.push((value / 1e18).toString());
      }
    }
  });
  if (data.length > 0 && graphDates.length > 0) {
    const graphData = {
      label: "Ethereum",
      fill: true,
      lineTension: 0.3,
      backgroundColor: "rgba(184, 185, 210, .3)",
      borderColor: "rgb(35, 26, 136)",
      borderCapStyle: "butt",
      borderDash: [],
      borderDashOffset: 0.0,
      borderJoinStyle: "miter",
      pointBorderColor: "rgb(35, 26, 136)",
      pointBackgroundColor: "rgb(255, 255, 255)",
      pointBorderWidth: 10,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: "rgb(0, 0, 0)",
      pointHoverBorderColor: "rgba(220, 220, 220, 1)",
      pointHoverBorderWidth: 2,
      pointRadius: 1,
      pointHitRadius: 10,
      data,
    };
    return fillDates({ graphData, graphDates });
  }
  return {};
}

function App(props) {
  const mainnetProvider = scaffoldEthProvider && scaffoldEthProvider._network ? scaffoldEthProvider : mainnetInfura;

  const [injectedProvider, setInjectedProvider] = useState();
  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangePrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProvider = useUserProvider(injectedProvider, localProvider);
  const address = useUserAddress(userProvider);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId = userProvider && userProvider._network && userProvider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userProvider, gasPrice);

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  // const yourMainnetBalance = useBalance(mainnetProvider, address);

  // Load in your local 📝 contract and read a value from it:
  // const readContracts = useContractLoader(localProvider)

  // If you want to make 🔐 write transactions to your contracts, use the userProvider:
  // const writeContracts = useContractLoader(userProvider)

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  //  const mainnetDAIContract = useExternalContractLoader(mainnetProvider, DAI_ADDRESS, DAI_ABI)

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  // Then read your DAI balance like:
  //  const myMainnetDAIBalance = useContractReader({DAI: mainnetDAIContract},"DAI", "balanceOf",["0x34aA3F359A9D614239015126635CE7732c18fDF3"])

  // keep track of a variable from the contract in the local React state:
  // const purpose = useContractReader(readContracts,"YourContract", "purpose")

  // 📟 Listen for broadcast events
  // const setPurposeEvents = useEventListener(readContracts, "YourContract", "SetPurpose", localProvider, 1);

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  const [data, setData] = useState();

  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance /* &&  yourMainnetBalance &&readContracts && writeContracts && mainnetDAIContract */
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? formatEther(yourLocalBalance) : "...");
      /* console.log("💵 yourMainnetBalance",yourMainnetBalance?formatEther(yourMainnetBalance):"...") */
      /*  console.log("📝 readContracts",readContracts) */
      /* console.log("🌍 DAI contract on mainnet:",mainnetDAIContract) */
      /*  console.log("🔐 writeContracts",writeContracts) */
      ethereumTransactionProvider(address).then(providedData => {
        setData(providedData);
      });
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance /* yourMainnetBalance, readContracts, writeContracts, mainnetDAIContract */,
  ]);

  let networkDisplay = "";
  if (localChainId && selectedChainId && localChainId !== selectedChainId) {
    networkDisplay = (
      <div style={{ zIndex: 2, position: "absolute", right: 0, top: 0, padding: 16 }}>
        <Alert
          message="⚠️ Wrong Network"
          description={
            <div>
              You have <b>{NETWORK(selectedChainId).name}</b> selected and you need to be on{" "}
              <b>{NETWORK(localChainId).name}</b>.
            </div>
          }
          type="error"
          closable={false}
        />
      </div>
    );
  } else {
    networkDisplay = (
      <div style={{ zIndex: -1, position: "absolute", right: 154, top: 8, padding: 16, color: targetNetwork.color }}>
        {targetNetwork.name}
      </div>
    );
  }

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new Web3Provider(provider));
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name === "localhost";

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (
    !faucetClicked &&
    localProvider &&
    localProvider._network &&
    localProvider._network.chainId === 31337 &&
    yourLocalBalance &&
    formatEther(yourLocalBalance) <= 0
  ) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: parseEther("0.01"),
            });
            setFaucetClicked(true);
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  const isSigner = injectedProvider && injectedProvider.getSigner && injectedProvider.getSigner()._isSigner;

  const [loading, setLoading] = useState();

  const [result, setResult] = useState();

  let display = "";
  if (result) {
    let possibleTxId = result.substr(-66);
    console.log("possibleTxId", possibleTxId);
    let extraLink = "";
    if (possibleTxId.indexOf("0x") === 0) {
      extraLink = (
        <a href={blockExplorer + "tx/" + possibleTxId} target="_blank" rel="noreferrer">
          view transaction on etherscan
        </a>
      );
    } else {
      possibleTxId = "";
    }
    display = (
      <div style={{ marginTop: 32 }}>
        {result.replace(possibleTxId, "")} {extraLink}
      </div>
    );
  } else if (isSigner && data && "graphDates" in data && "graphData" in data) {
    const state = {
      dataLine: {
        labels: data.graphDates,
        datasets: [data.graphData],
      },
    };
    display = (
      <>
        <Line data={state.dataLine} options={{ responsive: true, animation: { duration: 0 } }} />
      </>
    );
  }

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}
      <Header />
      {networkDisplay}
      {/*

      <BrowserRouter>

        <Menu style={{ textAlign:"center" }} selectedKeys={[route]} mode="horizontal">
          <Menu.Item key="/">
            <Link onClick={()=>{setRoute("/")}} to="/">Mainnet DAI</Link>
          </Menu.Item>
          <Menu.Item key="/hints">
            <Link onClick={()=>{setRoute("/hints")}} to="/hints">Hints</Link>
          </Menu.Item>
          <Menu.Item key="/exampleui">
            <Link onClick={()=>{setRoute("/exampleui")}} to="/exampleui">ExampleUI</Link>
          </Menu.Item>
          <Menu.Item key="/subgraph">
            <Link onClick={()=>{setRoute("/subgraph")}} to="/subgraph">Subgraph</Link>
          </Menu.Item>
        </Menu>


        <Switch>
          <Route exact path="/">

            <Contract
              name="DAI"
              customContract={mainnetDAIContract}
              signer={userProvider.getSigner()}
              provider={mainnetProvider}
              address={address}
              blockExplorer={"https://etherscan.io/"}
            />


          </Route>
          <Route path="/hints">
            <Hints
              address={address}
              yourLocalBalance={yourLocalBalance}
              mainnetProvider={mainnetProvider}
              price={price}
            />
          </Route>
          <Route path="/exampleui">
            <ExampleUI
              address={address}
              userProvider={userProvider}
              mainnetProvider={mainnetProvider}
              localProvider={localProvider}
              yourLocalBalance={yourLocalBalance}
              price={price}
              tx={tx}
            />
          </Route>
          <Route path="/subgraph">
            <Subgraph
            subgraphUri={props.subgraphUri}
            tx={tx}
            mainnetProvider={mainnetProvider}
            />
          </Route>
        </Switch>

      </BrowserRouter>
      */}
      <ThemeSwitch />

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      <div style={{ textAlign: "center", padding: 10 }}>
        <Account
          connectText="Connect Ethereum Wallet"
          onlyShowButton={!isSigner}
          address={address}
          localProvider={localProvider}
          userProvider={userProvider}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
      </div>
      {display && (
        <MDBContainer fluid>
          <MDBRow>
            <MDBCol md="3">Test</MDBCol>
            <MDBCol md="9">{display}</MDBCol>
          </MDBRow>
        </MDBContainer>
      )}

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support:
       <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
         <Row align="middle" gutter={[4, 4]}>
           <Col span={8}>
             <Ramp price={price} address={address} networks={NETWORKS}/>
           </Col>

           <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
             <GasGauge gasPrice={gasPrice} />
           </Col>
           <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
             <Button
               onClick={() => {
                 window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
               }}
               size="large"
               shape="round"
             >
               <span style={{ marginRight: 8 }} role="img" aria-label="support">
                 💬
               </span>
               Support
             </Button>
           </Col>
         </Row>

         <Row align="middle" gutter={[4, 4]}>
           <Col span={24}>
             {
               faucetAvailable ? (
                 <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider}/>
               ) : (
                 ""
               )
             }
           </Col>
         </Row>
       </div> */}
    </div>
  );
}

/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = new Web3Modal({
  // network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
});

const logoutOfWeb3Modal = async () => {
  await web3Modal.clearCachedProvider();
  setTimeout(() => {
    window.location.reload();
  }, 1);
};

window.ethereum &&
  window.ethereum.on("chainChanged", chainId => {
    web3Modal.cachedProvider &&
      web3Modal.cachedProvider !== "injected" &&
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });

window.ethereum &&
  window.ethereum.on("accountsChanged", accounts => {
    web3Modal.cachedProvider &&
      web3Modal.cachedProvider !== "injected" &&
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });

export default App;
