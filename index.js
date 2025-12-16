const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

const app = express()
// app.use(cors())
app.use(
    cors({
        origin: [
            // process.env.CLIENT_DOMAIN,
            'http://localhost:5173',
            'http://localhost:5174',
            'https://home-decoration-ph.web.app',
        ],
        credentials: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
)

app.use(express.json())
const port = process.env.PORT || 3000
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, 'base64').toString(
    'utf-8'
)
const serviceAccount = JSON.parse(decoded)
// const serviceAccount = require("path/to/serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const client = new MongoClient(process.env.MONGODB_uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const verifyJWT = async (req, res, next) => {
    const token = req?.headers?.authorization?.split(' ')[1]
    // console.log(token)
    if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
    try {
        const decoded = await admin.auth().verifyIdToken(token)
        req.tokenEmail = decoded.email
        // console.log(decoded)
        next()
    } catch (err) {
        // console.log(err)
        return res.status(401).send({ message: 'Unauthorized Access!', err })
    }
}

async function run() {
    try {
        const db = client.db("homeDecorationDB");
        const usersCollection = db.collection("users");
        const servicesCollection = db.collection("services");
        const ordersCollection = db.collection("orders");


        const verifyAdmin = async (req, res, next) => {
            const email = req.tokenEmail;
            const user = await usersCollection.findOne({ email });

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Admin access only' });
            }

            next();
        };
        const verifyDecorator = async (req, res, next) => {
            const email = req.tokenEmail;
            const user = await usersCollection.findOne({ email });

            if (user?.role !== 'decorator') {
                return res.status(403).send({ message: 'Decorator access only' });
            }
            next();
        };




        // Users APIs
        app.post('/users', verifyJWT, async (req, res) => {
            const user = req.body;
            user.role = 'user';
            user.createdAt = new Date();
            user.lastLogin = new Date();
            const alreadyUser = await usersCollection.findOne({ email: user.email });
            if (alreadyUser) {
                return res.send({ message: 'User already exists' });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        app.patch('/users', async (req, res) => {
            const user = req.body;
            const updateDoc = {
                $set: {
                    lastLogin: new Date()
                }
            }
            const result = await usersCollection.updateOne({ email: user.email }, updateDoc);
            res.send(result);
        });
        app.get('/users/role/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role });
        });
        app.patch('/users/account-status/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const { accountStatus } = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    accountStatus
                }
            };
            const user = await usersCollection.updateOne(query, updateDoc);
            res.send(user);
        });
        app.patch('/users/role/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const { role } = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: role
                }
            };
            const user = await usersCollection.updateOne(query, updateDoc);
            res.send(user);
        });

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const user = await usersCollection.find({ role: { $ne: "admin" } }).toArray();
            res.send(user);
        });
        app.get('/users/decorators', verifyJWT, verifyAdmin, async (req, res) => {
            const user = await usersCollection.find({ role: 'decorator', accountStatus: 'available' || null }).toArray();
            res.send(user);
        });
        app.get('/login-users', verifyJWT, async (req, res) => {
            const user = await usersCollection.findOne({ email: req.tokenEmail })
            res.send(user);
        });
        app.delete('/users/delete-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        }
        );


        // Services APIs
        app.post('/services', verifyJWT, verifyAdmin, async (req, res) => {
            const service = req.body;
            service.createdAt = new Date();
            const result = await servicesCollection.insertOne(service);
            res.send(result);
        })
        app.patch('/services', verifyJWT, verifyAdmin, async (req, res) => {
            const { id, serviceName, cost, unit, image, category, description, createdBy } = req.body;

            if (!id) return res.status(400).send({ message: "Service ID is required" });

            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    serviceName,
                    cost,
                    unit,
                    image,
                    category,
                    description,
                    createdBy,
                    updatedAt: new Date()
                }
            };
            const result = await servicesCollection.updateOne(query, updateDoc);
            res.send(result);
        })
        app.get('/services', async (req, res) => {
            const result = await servicesCollection.find().toArray();
            res.send(result);
        })
        app.get('/services/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) };
            const service = await servicesCollection.findOne(query);
            res.send(service);
        })

        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body
            // res.send(paymentInfo)
            // console.log(paymentInfo)
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: paymentInfo?.serviceName,
                                description: paymentInfo?.description,
                                images: [paymentInfo.photo],
                            },
                            unit_amount: Number(paymentInfo?.price) * 100
                        },
                        quantity: 1,
                    },
                ],
                customer_email: paymentInfo?.userEmail,
                mode: 'payment',
                metadata: {
                    serviceId: paymentInfo?.serviceId,
                    customer_name: paymentInfo?.userName,
                    customer_email: paymentInfo?.userEmail,
                    seller_email: paymentInfo?.ownerEmail,
                    name: paymentInfo?.serviceName,
                    category: paymentInfo?.category,
                    photo: paymentInfo?.photo,
                    quantity: 1,
                    location: paymentInfo?.location,
                    createdAt: new Date(),
                    servideDate: paymentInfo?.date
                },
                success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.CLIENT_DOMAIN}/payment-fail`,
            });
            res.send({ url: session.url });
        });

        app.post('/payment-success', async (req, res) => {
            const session_id = req.query.session_id;
            const session = await stripe.checkout.sessions.retrieve(session_id);
            // console.log("anik", session_id)
            if (session.status === 'complete') {
                const alreadyExist = await ordersCollection.findOne({ transactionId: session.payment_intent })
                if (alreadyExist) {
                    return res.send({ transactionId: session.payment_intent })
                }
                const orderInfo = {
                    serviceId: session.metadata.serviceId,
                    transactionId: session.payment_intent,
                    customerEmail: session.metadata.customer_email,
                    customerName: session.metadata.customer_name,
                    status: 'pending',
                    sellerEmail: session.metadata.seller_email,
                    name: session.metadata.name,
                    category: session.metadata.category,
                    quantity: session.metadata.quantity,
                    photo: session.metadata.photo,
                    price: session.amount_total / 100,
                    location: session.metadata.location,
                    createdAt: session.metadata.createdAt,
                    servideDate: session.metadata.servideDate
                }
                const result = await ordersCollection.insertOne(orderInfo)
                res.send({ transactionId: session.payment_intent });

            }
        });
        app.get("/stripe/user-transactions/:email", async (req, res) => {
            try {
                const email = req.params.email;
                const sessions = await stripe.checkout.sessions.list({
                    limit: 5,

                });
                const userSessions = sessions.data.filter(
                    (s) => s.customer_email === email
                );
                const transactions = userSessions.map((s) => ({
                    transactionId: s.payment_intent,
                    amount: s.amount_total / 100,
                    currency: s.currency,
                    status: s.status,
                    email: s.customer_email,
                    serviceId: s.metadata.serviceId,
                    serviceName: s.metadata.name,
                    category: s.metadata.category,
                    photo: s.metadata.photo,
                    createdAt: s.created,
                }));
                res.send(transactions);

            } catch (error) {
                // console.error(error);
                res.status(500).send({ error: error.message });
            }
        });


        app.get('/manage-decorators-services', verifyJWT, verifyAdmin, async (req, res) => {
            const user = await ordersCollection.find({ status: { $ne: "pending" } }).toArray();
            res.send(user);
        })
        app.get('/orders', verifyJWT, async (req, res) => {
            const orders = await ordersCollection.find().toArray();
            res.send(orders);
        })
        app.patch('/orders/assign', verifyJWT, verifyAdmin, async (req, res) => {
            const { orderId, assignedDecoratorEmail } = req.body;
            // console.log(orderId, assignedDecoratorEmail)

            if (!orderId || !assignedDecoratorEmail) {
                return res.status(400).send({ message: 'orderId and assignedDecoratorEmail are required' });
            }
            try {
                const result = await ordersCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    { $set: { assignedDecoratorEmail, status: 'Assigned' } } // also update status
                );

                if (result.modifiedCount === 1) {
                    return res.send({ message: 'Decorator assigned successfully' });
                } else {
                    return res.status(404).send({ message: 'Order not found or already assigned' });
                }
            } catch (err) {
                // console.error(err);
                return res.status(500).send({ message: 'Server error', err });
            }

        })
        app.get('/orders/manage-booking', verifyJWT, verifyAdmin, async (req, res) => {
            const orders = await ordersCollection.find({ status: "pending" }).toArray();
            res.send(orders);
        })
        app.get('/orders/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            // console.log(email)
            const orders = await ordersCollection.find({ customerEmail: email }).toArray();
            res.send(orders);
        })
        app.delete('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const orders = await ordersCollection.deleteOne({ _id: new ObjectId(id) })
            res.send(orders);
        })
        app.get('/decorator/earnings', verifyJWT, verifyDecorator, async (req, res) => {
            const email = req.tokenEmail;
            const orders = await ordersCollection.find({
                assignedDecoratorEmail: email
            }).toArray();

            const total = orders.reduce((sum, o) => sum + (o.price * 0.6), 0);
            const completed = orders.filter(o => o.status === 'Completed').length;
            const pending = orders.filter(o => o.status !== 'Completed').length;

            res.send({ total, completed, pending });
        });
        app.get('/decorator/today-schedule', verifyJWT, verifyDecorator, async (req, res) => {
            const email = req.tokenEmail;
            const today = new Date().toISOString().split('T')[0];
            // console.log("today", today)
            const jobs = await ordersCollection.find({
                assignedDecoratorEmail: email,
                servideDate: today
            }).toArray();

            res.send(jobs);
        });
        app.patch('/decorator/projects/:id', verifyJWT, verifyDecorator, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;

            const result = await ordersCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );

            res.send(result);
        });
        app.get('/decorator/projects', verifyJWT, verifyDecorator, async (req, res) => {
            const email = req.tokenEmail;

            const projects = await ordersCollection.find({
                assignedDecoratorEmail: email
            }).toArray();

            res.send(projects);
        });


        // adminAnalytics APIs
        app.get('/revenue', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await ordersCollection.aggregate([
                {
                    $addFields: {
                        createdDate: {
                            $toDate: {
                                $multiply: [{ $toLong: "$createdAt" }, 1000]
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: { $month: "$createdDate" },
                        revenue: { $sum: "$price" }
                    }
                },
                { $sort: { _id: 1 } }
            ]).toArray();

            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            const formatted = result.map(item => ({
                month: monthNames[item._id - 1],
                revenue: item.revenue
            }));

            res.send(formatted);
        });


        app.get('/service-demand', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await ordersCollection.aggregate([
                {
                    $group: {
                        _id: "$category",
                        bookings: { $sum: 1 }
                    }
                },
                { $sort: { bookings: -1 } }
            ]).toArray();

            const formatted = result.map(item => ({
                service: item._id,
                bookings: item.bookings
            }));

            res.send(formatted);
        });




        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
