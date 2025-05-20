library(community)
dir.create("docs/data", FALSE)

# if there are datasets to add, include any preprocessing steps here
write.csv(
  cbind(name = rownames(mtcars), mtcars),
  "docs/data/mtcars.csv",
  row.names = FALSE
)

# then add them to the site:
data_add(
  c(mtcars = "mtcars.csv"),
  meta = list(
    ids = list(variable = "name")
  ),
  dir = "docs/data",
  refresh = TRUE
)

# render the site:
site_build(".", serve = TRUE, open_after = TRUE)
