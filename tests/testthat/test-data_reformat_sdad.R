test_that("produces expected datasets", {
  f1 <- data.frame(
    geoid = c(1, 1, 2, 2, 3),
    year = c(1, 2, 3, 1, 2),
    v = rnorm(5),
    measure = c("a", "a", "b", "b", "b"),
    region_type = "a"
  )
  f2 <- data.frame(
    geoid = c(10, 10, 10, 11, 11),
    year = c(1, 2, 3, 1, 2),
    v = rnorm(5),
    measure = c("a", "a", "b", "b", "c"),
    region_type = "b"
  )
  dir <- tempdir(TRUE)
  paths <- paste0(dir, "/", c("f1_0000_", "f2_0000_"), ".csv")
  write.csv(f1, paths[1], row.names = FALSE)
  write.csv(f2, paths[2], row.names = FALSE)
  r <- data_reformat_sdad(paths, out = dir)
  expect_true(all(file.exists(paths)))
  b <- rep(NA, nrow(r$a))
  b[c(4, 6, 8)] <- f1[c(4, 3, 5), "v"]
  expect_equal(
    r,
    list(
      a = data.frame(
        ID = rep(as.character(1:3), each = 3),
        time = rep(1:3, 3),
        a = c(f1[1:2, "v"], rep(NA, 7)),
        b = b,
        c = NA
      ),
      b = data.frame(
        ID = rep(as.character(10:11), each = 3),
        time = rep(1:3, 2),
        a = c(f2[1:2, "v"], rep(NA, 4)),
        b = c(NA, NA, f2[3:4, "v"], NA, NA),
        c = c(rep(NA, 4), f2[5, "v"], NA)
      )
    )
  )
})
