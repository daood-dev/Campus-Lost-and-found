module.exports = {
  CATEGORIES: ['ID Card', 'Wallet', 'Mobile Phone', 'Keys', 'Bag', 'Books & Notes', 'Electronics', 'Clothing', 'Water Bottle', 'Other'],
  LOCATIONS: ['Main Library', 'Cafeteria', 'Admin Block', 'Computer Lab', 'Lecture Hall Block', 'Sports Ground', 'Parking Area', 'Hostel', 'Auditorium', 'Other'],
  STATUSES: ['Open', 'Under Review', 'Matched', 'Claimed', 'Recovered'],
  ROLES: ['student', 'staff', 'admin'],
  MATCH_THRESHOLD: Number(process.env.MATCH_THRESHOLD || 55)
};
