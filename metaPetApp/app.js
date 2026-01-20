const express = require('express');
//Set up view engine from ejs library
const app = express();
//Set up view engine
app.set('view engine', 'ejs');
//This line of code tells Express to serve static files (such as images, CSS, JavaScript files, or PDFs)
//from the public directory
app.use(express.static('public'))
//enable form processing
app.use(express.urlencoded({
    extended: false
}));

//start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// declare the global variables
var account = '';

function renderShopHome(res) {
  res.render('shop_home', {
    acct: account
  });
}

// Define routes - home page
app.get('/', async(req, res) => {   
    console.log("home page");
    try {
      renderShopHome(res);
    } catch (error) {
        console.error('Error in home route:', error);
        res.status(500).send('Server error');
    }
});

app.get('/shop', async (req, res) => {
  try {
    renderShopHome(res);
  } catch (error) {
    console.error('Error in shop route:', error);
    res.status(500).send('Server error');
  }
});


app.get('/orders/new', (req, res) => {
  res.render('order_create', { acct: account });
});

app.get('/orders/manage', (req, res) => {
  res.render('order_actions', { orderData: null });
});

app.get('/escrow/new', (req, res) => {
  res.render('escrow_create');
});

app.get('/orders/complete', (req, res) => {
  res.render('order_complete');
});

app.get('/disputes/raise', (req, res) => {
  res.render('dispute_raise');
});

app.get('/disputes/resolve', (req, res) => {
  res.render('dispute_resolve');
});

app.get('/orders/view', (req, res) => {
  res.render('order_view', { orderSummary: null });
});

app.get('/platform/admin', (req, res) => {
  res.render('platform_admin', { platformState: null });
});
