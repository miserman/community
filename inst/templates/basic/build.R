library(community)

# add code to create/update and document data as-needed
write.csv(
  data.frame(v1 = 1:10, v2 = letters[1:10]),
  "data.csv",
  row.names = FALSE
)
data_add("data.csv")

# rebuild the site after data and/or site.R changes
site_build(".", version = "local", serve = TRUE)
