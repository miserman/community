test_that("copies a local site", {
  dir <- if (dir.exists("../community_example")) "../community_example" else
    "../../community_example"
  skip_if_not(dir.exists(dir), "no test site available")
  cdir <- paste0(tempdir(), "/site_child")
  site_make_child(dir, cdir)
  expect_true(check_template("site", dir = cdir)$exists)
})

test_that("copies a remote site", {
  skip_if_not(
    grepl("R_LIBS", getwd(), fixed = TRUE),
    "not downloading site files"
  )
  cdir <- paste0(tempdir(), "/site_child_remote")
  site_make_child("miserman/community_example", cdir)
  expect_true(check_template("site", dir = cdir)$exists)
})
